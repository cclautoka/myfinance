-- Additive: email tokens (verify / reset / magic login), pairing, per-household API keys, household row, email_verified_at.
-- Safe to run after 001_household_platform.sql. Idempotent where possible.

create table if not exists household (
  household_id text primary key,
  created_at timestamptz not null default now()
);

insert into household (household_id)
select household_id from finance_state
on conflict (household_id) do nothing;

alter table household_member add column if not exists email_verified_at timestamptz;

create table if not exists household_email_token (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references household_member(id) on delete cascade,
  token_hash text not null unique,
  kind text not null check (kind in ('verify', 'reset', 'magic_login')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table household_email_token drop constraint if exists household_email_token_kind_check;
alter table household_email_token add constraint household_email_token_kind_check
  check (kind in ('verify', 'reset', 'magic_login'));

create table if not exists household_pairing (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null,
  household_id text not null,
  inviter_member_id uuid not null references household_member(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists household_pairing_household_active_idx
  on household_pairing (household_id) where used_at is null;

create table if not exists household_bearer_key (
  id uuid primary key default gen_random_uuid(),
  household_id text not null,
  token_hash text not null,
  label text not null default '',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists household_bearer_key_household_idx
  on household_bearer_key (household_id) where revoked_at is null;
