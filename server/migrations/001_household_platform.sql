-- Additive household auth (safe to run on existing DBs). Mirrors server/db.mjs init.
-- For email tokens, pairing, bearer keys, and household row, also run 002_household_email_pairing_bearer.sql (or rely on server auto-migration on boot).

create table if not exists household_member (
  id uuid primary key default gen_random_uuid(),
  household_id text not null,
  email text not null,
  password_hash text,
  role text not null check (role in ('owner', 'partner', 'viewer')),
  created_at timestamptz not null default now()
);

create unique index if not exists household_member_household_email_lower
  on household_member (household_id, lower(email));

create table if not exists household_invite (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  household_id text not null,
  inviter_member_id uuid references household_member(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists auth_session (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null unique,
  household_id text not null,
  member_id uuid not null references household_member(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_session_member_idx on auth_session (member_id);
