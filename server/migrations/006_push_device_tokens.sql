-- Device push tokens for native iOS/Android apps (FCM registration tokens).

create table if not exists push_device_token (
  id uuid primary key default gen_random_uuid(),
  household_id text not null,
  member_id uuid not null references household_member(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  token text not null,
  device_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists push_device_token_token_uq on push_device_token (token);

create index if not exists push_device_token_household_idx on push_device_token (household_id);

create index if not exists push_device_token_member_idx on push_device_token (member_id);
