#!/usr/bin/env node
/**
 * One-time: upsert finance_state + primary owner for the migrated household.
 *
 * Usage (from repo root or server/):
 *   cd server && SEED_OWNER_PASSWORD='your-secure-password' node scripts/seed-shahil-household.mjs
 *
 * Optional env:
 *   DATABASE_URL (required)
 *   SEED_HOUSEHOLD_ID (default: id from prior Tools & alerts screenshot)
 *   SEED_OWNER_EMAIL (default: shahilsunny18@gmail.com)
 *   SEED_SNAPSHOT_MONTH (default: 2026-05) — bill keys + month-opening row
 *   SEED_UPDATE_PASSWORD=1 — if owner already exists, rotate password hash
 */
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../password.mjs';
import {
  countOwnersForHousehold,
  ensureHouseholdRow,
  findMemberByHouseholdAndEmail,
  initDbIfNeeded,
  insertHouseholdMember,
  updateMemberPassword,
  writeState,
} from '../db.mjs';
import { buildShahilFinanceState } from './shahil-seed-state.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const HOUSEHOLD_ID = (process.env.SEED_HOUSEHOLD_ID ?? '81c575ad5352b15bbb964349ed258cd8').trim().slice(0, 64);
const OWNER_EMAIL = (process.env.SEED_OWNER_EMAIL ?? 'shahilsunny18@gmail.com').trim().toLowerCase();
const SNAPSHOT_MONTH = (process.env.SEED_SNAPSHOT_MONTH ?? '2026-05').trim();
const password = (process.env.SEED_OWNER_PASSWORD ?? '').trim();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to server/.env');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Set SEED_OWNER_PASSWORD (min 8 characters) for the primary owner account.');
    process.exit(1);
  }

  await initDbIfNeeded(console);
  const state = buildShahilFinanceState(SNAPSHOT_MONTH);
  const { updatedAt } = await writeState(HOUSEHOLD_ID, state);
  console.log(`finance_state upserted for household_id=${HOUSEHOLD_ID} updated_at=${updatedAt}`);

  const existing = await findMemberByHouseholdAndEmail(HOUSEHOLD_ID, OWNER_EMAIL);
  const owners = await countOwnersForHousehold(HOUSEHOLD_ID);

  if (existing) {
    if (process.env.SEED_UPDATE_PASSWORD === '1') {
      await updateMemberPassword(existing.id, hashPassword(password));
      console.log(`Updated password hash for existing owner ${OWNER_EMAIL}`);
    } else {
      console.log(`Owner row already exists for ${OWNER_EMAIL} — skipped password (set SEED_UPDATE_PASSWORD=1 to rotate).`);
    }
  } else {
    if (owners > 0) {
      console.error(
        `Household already has ${owners} owner(s) but not ${OWNER_EMAIL}. Refusing to add a second owner — fix DB or use invite flow.`,
      );
      process.exit(1);
    }
    const row = await insertHouseholdMember({
      householdId: HOUSEHOLD_ID,
      email: OWNER_EMAIL,
      passwordHash: hashPassword(password),
      role: 'owner',
    });
    await ensureHouseholdRow(HOUSEHOLD_ID);
    console.log(`Created primary owner ${OWNER_EMAIL} member_id=${row.id}`);
  }

  await ensureHouseholdRow(HOUSEHOLD_ID);
  console.log('Done. In the app: set Household id to this value, sign in with email + password, then pull from server.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
