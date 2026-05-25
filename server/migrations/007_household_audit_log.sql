-- Household change audit trail (who / what / platform / when).
create table if not exists household_audit_log (
  id uuid primary key default gen_random_uuid(),
  household_id text not null,
  member_id uuid references household_member(id) on delete set null,
  member_role text not null,
  member_email text not null default '',
  client_platform text not null default 'web',
  summary text not null default '',
  changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists household_audit_log_household_created_idx
  on household_audit_log (household_id, created_at desc);
