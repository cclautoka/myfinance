-- Partner email on invite + link to pre-created partner member (never-expire invites use far-future expires_at).

alter table household_invite add column if not exists partner_email text;
alter table household_invite add column if not exists partner_member_id uuid references household_member(id) on delete set null;

create index if not exists household_invite_partner_member_idx
  on household_invite (partner_member_id) where partner_member_id is not null;
