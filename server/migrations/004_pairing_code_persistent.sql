-- Pairing codes do not expire; store digits so owner can re-share the same household code.

alter table household_pairing add column if not exists code_plain text;
