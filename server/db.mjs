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
    log?.info?.('Postgres ready (finance_state)');
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
  return { updatedAt: r.rows[0].updated_at };
}

