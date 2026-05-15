-- Store invite token plaintext so owners can re-open partner links (invites do not expire).
alter table household_invite add column if not exists token_plain text;

create index if not exists household_invite_partner_active_idx
  on household_invite (household_id, lower(partner_email))
  where used_at is null and token_plain is not null;
