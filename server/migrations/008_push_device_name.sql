-- Human-friendly device labels for push registrations.

alter table push_device_token
  add column if not exists device_name text not null default '';

create index if not exists push_device_token_device_name_idx
  on push_device_token (device_name);

