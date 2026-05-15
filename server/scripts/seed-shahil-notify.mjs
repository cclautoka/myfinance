#!/usr/bin/env node
/**
 * Seed husband/wife notify emails + partner member for Shahil household.
 *
 * Usage:
 *   cd server && node scripts/seed-shahil-notify.mjs
 *
 * Optional env:
 *   DATABASE_URL (required)
 *   SEED_HOUSEHOLD_ID (default: 61c575ad5352b15bbb964349ed258cd6)
 *   SEED_HUSBAND_EMAIL (default: shahilsunny18@gmail.com)
 *   SEED_WIFE_EMAIL (default: zahrafatima.o898@gmail.com)
 *   CONFIRM=1 — required to write
 */
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findMemberByHouseholdAndEmail,
  initDbIfNeeded,
  insertHouseholdMember,
  listMembersForHousehold,
  markMemberEmailVerified,
} from '../db.mjs';
import { readSnapshot, writeSnapshot } from '../snapshots.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const HOUSEHOLD_ID = (process.env.SEED_HOUSEHOLD_ID ?? '61c575ad5352b15bbb964349ed258cd6').trim().slice(0, 64);
const HUSBAND = (process.env.SEED_HUSBAND_EMAIL ?? 'shahilsunny18@gmail.com').trim().toLowerCase();
const WIFE = (process.env.SEED_WIFE_EMAIL ?? 'zahrafatima.o898@gmail.com').trim().toLowerCase();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  if (process.env.CONFIRM !== '1') {
    console.error(
      `Dry run. Re-run with CONFIRM=1 to seed notify emails and partner.\n  household=${HOUSEHOLD_ID}\n  husband=${HUSBAND}\n  wife=${WIFE}`,
    );
    process.exit(1);
  }

  await initDbIfNeeded(console);

  const owner = await findMemberByHouseholdAndEmail(HOUSEHOLD_ID, HUSBAND);
  if (!owner) {
    console.error(`Owner not found: ${HUSBAND} in household ${HOUSEHOLD_ID}. Run seed-shahil-household first.`);
    process.exit(1);
  }
  if (owner.role !== 'owner') {
    console.error(`${HUSBAND} exists but role is ${owner.role}, expected owner.`);
    process.exit(1);
  }

  let wifeMember = await findMemberByHouseholdAndEmail(HOUSEHOLD_ID, WIFE);
  if (!wifeMember) {
    wifeMember = await insertHouseholdMember({
      householdId: HOUSEHOLD_ID,
      email: WIFE,
      passwordHash: null,
      role: 'partner',
    });
    console.log(`Created partner member ${WIFE} id=${wifeMember.id}`);
  } else {
    console.log(`Partner member already exists: ${WIFE}`);
  }

  await markMemberEmailVerified(wifeMember.id);
  console.log(`Marked verified: ${WIFE}`);

  if (!owner.email_verified_at) {
    await markMemberEmailVerified(owner.id);
    console.log(`Marked verified: ${HUSBAND}`);
  }

  const notifyEmails = { husbandEmail: HUSBAND, wifeEmail: WIFE };
  const list = [HUSBAND, WIFE];
  const existing = await readSnapshot(HOUSEHOLD_ID).catch(() => null);
  const data = existing?.data && typeof existing.data === 'object' ? existing.data : {};
  await writeSnapshot(HOUSEHOLD_ID, {
    ...data,
    notifyRecipientEmails: list,
    notifyEmails,
  });
  console.log(`Snapshot notify emails: husband=${HUSBAND} wife=${WIFE}`);

  const members = await listMembersForHousehold(HOUSEHOLD_ID);
  console.log(`Household members (${members.length}):`);
  for (const m of members) {
    console.log(`  ${m.role.padEnd(7)} ${m.email} verified=${Boolean(m.email_verified_at)}`);
  }
  console.log('Done. Owner should reload Tools or sign in again to pull emails into this browser.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
