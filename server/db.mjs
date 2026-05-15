import { Pool } from 'pg';

let pool = null;
let initPromise = null;

function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDbEnabled() {
  return hasDb();
}

export function getHouseholdIdFromRequest(request) {
  const q = request?.query ?? {};
  const raw = typeof q.id === 'string' ? q.id.trim() : '';
  const env = (process.env.HOUSEHOLD_ID ?? '').trim();
  return (raw || env || 'default').slice(0, 64);
}

export async function initDbIfNeeded(log) {
  if (!hasDb()) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`
      create table if not exists finance_state (
        household_id text primary key,
        state jsonb not null,
        updated_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      create table if not exists household_member (
        id uuid primary key default gen_random_uuid(),
        household_id text not null,
        email text not null,
        password_hash text,
        role text not null check (role in ('owner', 'partner', 'viewer')),
        created_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      create unique index if not exists household_member_household_email_lower
        on household_member (household_id, lower(email));
    `);
    await pool.query(`
      create table if not exists household_invite (
        id uuid primary key default gen_random_uuid(),
        token_hash text not null unique,
        household_id text not null,
        inviter_member_id uuid references household_member(id) on delete cascade,
        expires_at timestamptz not null,
        used_at timestamptz,
        created_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      create table if not exists auth_session (
        id uuid primary key default gen_random_uuid(),
        session_token_hash text not null unique,
        household_id text not null,
        member_id uuid not null references household_member(id) on delete cascade,
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      create index if not exists auth_session_member_idx on auth_session (member_id);
    `);
    await pool.query(`
      create table if not exists household (
        household_id text primary key,
        created_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      insert into household (household_id)
      select household_id from finance_state
      on conflict (household_id) do nothing;
    `);
    await pool.query(`
      alter table household_member add column if not exists email_verified_at timestamptz;
    `);
    await pool.query(`
      create table if not exists household_email_token (
        id uuid primary key default gen_random_uuid(),
        member_id uuid not null references household_member(id) on delete cascade,
        token_hash text not null unique,
        kind text not null check (kind in ('verify', 'reset', 'magic_login')),
        expires_at timestamptz not null,
        used_at timestamptz,
        created_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      alter table household_email_token drop constraint if exists household_email_token_kind_check;
    `);
    await pool.query(`
      alter table household_email_token add constraint household_email_token_kind_check
        check (kind in ('verify', 'reset', 'magic_login'));
    `);
    await pool.query(`
      create table if not exists household_pairing (
        id uuid primary key default gen_random_uuid(),
        code_hash text not null,
        household_id text not null,
        inviter_member_id uuid not null references household_member(id) on delete cascade,
        expires_at timestamptz not null,
        used_at timestamptz,
        created_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      create index if not exists household_pairing_household_active_idx
        on household_pairing (household_id) where used_at is null;
    `);
    await pool.query(`
      create table if not exists household_bearer_key (
        id uuid primary key default gen_random_uuid(),
        household_id text not null,
        token_hash text not null,
        label text not null default '',
        created_at timestamptz not null default now(),
        revoked_at timestamptz
      );
    `);
    await pool.query(`
      create index if not exists household_bearer_key_household_idx
        on household_bearer_key (household_id) where revoked_at is null;
    `);
    log?.info?.('Postgres ready (finance_state + household platform)');
  })();
  return initPromise;
}

export async function readState(householdId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    'select state, updated_at from finance_state where household_id = $1',
    [householdId],
  );
  if (!r.rowCount) return null;
  return { state: r.rows[0].state, updatedAt: r.rows[0].updated_at };
}

export async function writeState(householdId, state) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `insert into finance_state (household_id, state, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (household_id)
     do update set state = excluded.state, updated_at = now()
     returning updated_at`,
    [householdId, JSON.stringify(state)],
  );
  await pool.query(
    `insert into household (household_id) values ($1) on conflict (household_id) do nothing`,
    [householdId],
  );
  return { updatedAt: r.rows[0].updated_at };
}

/** --- Household auth (additive; no changes to finance_state shape) --- */

export async function findMemberByHouseholdAndEmail(householdId, email) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, household_id, email, password_hash, role, email_verified_at from household_member
     where household_id = $1 and lower(email) = lower($2) limit 1`,
    [householdId, email.trim()],
  );
  return r.rows[0] ?? null;
}

export async function insertHouseholdMember({ householdId, email, passwordHash, role }) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `insert into household_member (household_id, email, password_hash, role, email_verified_at)
     values ($1, $2, $3, $4, null)
     returning id, household_id, email, role, created_at`,
    [householdId, email.trim(), passwordHash, role],
  );
  return r.rows[0];
}

export async function countOwnersForHousehold(householdId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select count(*)::int as n from household_member where household_id = $1 and role = 'owner'`,
    [householdId],
  );
  return r.rows[0]?.n ?? 0;
}

export async function getMemberById(memberId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, household_id, email, password_hash, role, email_verified_at from household_member where id = $1`,
    [memberId],
  );
  return r.rows[0] ?? null;
}

export async function insertInvite({ tokenHash, householdId, inviterMemberId, expiresAt }) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `insert into household_invite (token_hash, household_id, inviter_member_id, expires_at)
     values ($1, $2, $3, $4)
     returning id, token_hash, household_id, expires_at`,
    [tokenHash, householdId, inviterMemberId, expiresAt],
  );
  return r.rows[0];
}

export async function getActiveInviteByTokenHash(tokenHash) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, household_id, inviter_member_id, expires_at, used_at from household_invite
     where token_hash = $1 and used_at is null limit 1`,
    [tokenHash],
  );
  return r.rows[0] ?? null;
}

export async function markInviteUsed(inviteId) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`update household_invite set used_at = now() where id = $1`, [inviteId]);
}

export async function insertAuthSession({ sessionTokenHash, householdId, memberId, expiresAt }) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(
    `insert into auth_session (session_token_hash, household_id, member_id, expires_at)
     values ($1, $2, $3, $4)`,
    [sessionTokenHash, householdId, memberId, expiresAt],
  );
}

export async function deleteAuthSessionByHash(sessionTokenHash) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`delete from auth_session where session_token_hash = $1`, [sessionTokenHash]);
}

export async function touchAuthSessionExpiry(sessionTokenHash, newExpiresAt) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`update auth_session set expires_at = $2 where session_token_hash = $1`, [
    sessionTokenHash,
    newExpiresAt,
  ]);
}

export async function ensureHouseholdRow(householdId) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(
    `insert into household (household_id) values ($1) on conflict (household_id) do nothing`,
    [householdId],
  );
}

export async function insertEmailToken({ memberId, tokenHash, kind, expiresAt }) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(
    `insert into household_email_token (member_id, token_hash, kind, expires_at)
     values ($1, $2, $3, $4)`,
    [memberId, tokenHash, kind, expiresAt],
  );
}

export async function deleteUnusedEmailTokens(memberId, kind) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(
    `delete from household_email_token where member_id = $1 and kind = $2 and used_at is null`,
    [memberId, kind],
  );
}

export async function getActiveEmailTokenByHash(tokenHash, kind) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select t.id, t.member_id, t.kind, t.expires_at, t.used_at, m.household_id, m.email, m.role, m.password_hash
     from household_email_token t
     join household_member m on m.id = t.member_id
     where t.token_hash = $1 and t.used_at is null and t.kind = $2 limit 1`,
    [tokenHash, kind],
  );
  return r.rows[0] ?? null;
}

export async function markEmailTokenUsed(tokenId) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`update household_email_token set used_at = now() where id = $1`, [tokenId]);
}

export async function markMemberEmailVerified(memberId) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`update household_member set email_verified_at = now() where id = $1`, [memberId]);
}

export async function updateMemberPassword(memberId, passwordHash) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`update household_member set password_hash = $2 where id = $1`, [memberId, passwordHash]);
}

export async function insertPairing({ codeHash, householdId, inviterMemberId, expiresAt }) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `insert into household_pairing (code_hash, household_id, inviter_member_id, expires_at)
     values ($1, $2, $3, $4)
     returning id`,
    [codeHash, householdId, inviterMemberId, expiresAt],
  );
  return r.rows[0];
}

export async function getActivePairingByHouseholdAndCodeHash(householdId, codeHash) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, household_id, inviter_member_id, expires_at from household_pairing
     where household_id = $1 and code_hash = $2 and used_at is null limit 1`,
    [householdId, codeHash],
  );
  return r.rows[0] ?? null;
}

export async function markPairingUsed(pairingId) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`update household_pairing set used_at = now() where id = $1`, [pairingId]);
}

export async function insertBearerKey({ householdId, tokenHash, label }) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `insert into household_bearer_key (household_id, token_hash, label)
     values ($1, $2, $3)
     returning id, created_at`,
    [householdId, tokenHash, label.slice(0, 80)],
  );
  return r.rows[0];
}

export async function listActiveBearerHashesForHousehold(householdId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select token_hash from household_bearer_key where household_id = $1 and revoked_at is null`,
    [householdId],
  );
  return r.rows.map((row) => row.token_hash);
}

export async function listBearerKeysForHousehold(householdId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, label, created_at, revoked_at from household_bearer_key where household_id = $1 order by created_at desc`,
    [householdId],
  );
  return r.rows;
}

export async function revokeBearerKey(keyId, householdId) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(
    `update household_bearer_key set revoked_at = now() where id = $1 and household_id = $2`,
    [keyId, householdId],
  );
}

/** Tables created by {@link initDbIfNeeded} — used by CLI migrate / smoke checks. */
const CORE_TABLES = [
  'finance_state',
  'household_member',
  'household',
  'household_invite',
  'auth_session',
  'household_email_token',
  'household_pairing',
  'household_bearer_key',
];

/** Run `initDbIfNeeded` then invoke `fn` with the pg pool (for one-off scripts). */
export async function withDb(fn) {
  await initDbIfNeeded(null);
  if (!pool) throw new Error('DATABASE_URL is not set');
  return fn(pool);
}

/** Returns whether all core tables exist (after migrations / init). */
export async function assertCoreTables(log) {
  await initDbIfNeeded(log);
  if (!pool) {
    return { ok: false, found: [], missing: [...CORE_TABLES], message: 'DATABASE_URL is not set' };
  }
  const r = await pool.query(
    `select tablename from pg_tables where schemaname = 'public' and tablename = any($1::text[])`,
    [CORE_TABLES],
  );
  const found = new Set(r.rows.map((x) => x.tablename));
  const missing = CORE_TABLES.filter((t) => !found.has(t));
  return { ok: missing.length === 0, found: [...found].sort(), missing };
}

