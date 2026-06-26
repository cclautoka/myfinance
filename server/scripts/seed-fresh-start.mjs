#!/usr/bin/env node
/**
 * Feed your real loans + expenses into a household with a clean slate from today.
 * Does NOT create members — register/sign in first, then run this to fill the workbook.
 *
 * Two ways to run:
 *
 * 1) On deploy (recommended) — runs inside the container, which can reach the internal DB.
 *    Set in Dokploy env: SEED_FRESH_START=1 and SEED_HOUSEHOLD_ID=<your household id>, then deploy.
 *    The Docker CMD calls this between db:migrate and server start. It is a no-op unless
 *    SEED_FRESH_START=1, and never blocks boot. Unset the flag after it runs once.
 *
 * 2) Manually, with DATABASE_URL reachable:
 *    cd server
 *    SEED_FRESH_START=1 SEED_HOUSEHOLD_ID=755f12b5181a85704f8886bda33a61fa npm run seed:fresh-start
 *
 * Safety: only acts when SEED_FRESH_START=1; refuses to overwrite a workbook that already
 * has data unless OVERWRITE=1.
 *
 * Env:
 *   SEED_FRESH_START=1 (required gate) — without it, this script exits 0 doing nothing.
 *   DATABASE_URL       (required) — must resolve from where this runs.
 *   SEED_HOUSEHOLD_ID  (required) — target household id (from app Tools & alerts, or list:households).
 *   OVERWRITE=1        (optional) — replace existing non-empty workbook.
 */
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureHouseholdRow, initDbIfNeeded, readState, writeState } from '../db.mjs';
import { buildFreshStartFinanceState } from './fresh-start-state.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const HOUSEHOLD_ID = (process.env.SEED_HOUSEHOLD_ID ?? '').trim().slice(0, 64);

function hasExistingData(state) {
  if (!state) return false;
  const debts = Array.isArray(state.debts) ? state.debts.length : 0;
  const essentials = Array.isArray(state.essentials) ? state.essentials.length : 0;
  const income = Array.isArray(state.incomeLog) ? state.incomeLog.length : 0;
  return debts > 0 || essentials > 0 || income > 0;
}

async function main() {
  if (process.env.SEED_FRESH_START !== '1') {
    console.log('seed:fresh-start — SEED_FRESH_START not set; skipping.');
    process.exit(0);
  }
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('DATABASE_URL is not set (must resolve from here). Add it to server/.env or the environment.');
    process.exit(1);
  }
  if (!HOUSEHOLD_ID) {
    console.error('SEED_HOUSEHOLD_ID is required. Example:');
    console.error('  SEED_HOUSEHOLD_ID=755f12b5181a85704f8886bda33a61fa node scripts/seed-fresh-start.mjs');
    process.exit(1);
  }

  await initDbIfNeeded(console);

  const existing = await readState(HOUSEHOLD_ID);
  if (hasExistingData(existing?.state) && process.env.OVERWRITE !== '1') {
    console.error(
      `Household ${HOUSEHOLD_ID} already has a non-empty workbook. Re-run with OVERWRITE=1 to replace it.`,
    );
    process.exit(1);
  }

  const state = buildFreshStartFinanceState(new Date());
  const { updatedAt } = await writeState(HOUSEHOLD_ID, state);
  await ensureHouseholdRow(HOUSEHOLD_ID);

  console.log(`Fresh-start workbook written for household_id=${HOUSEHOLD_ID} updated_at=${updatedAt}`);
  console.log(`  debts: ${state.debts.length}, essentials: ${state.essentials.length}, clean slate from today.`);
  console.log('In the app: sign in to this household, then pull from server (or reload).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
