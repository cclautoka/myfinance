#!/usr/bin/env node
/**
 * Backfill billPaymentAttribution and surprise paidByRole from JSON.
 *
 * Usage (from server/):
 *   node scripts/backfill-attribution.mjs --dry-run
 *   node scripts/backfill-attribution.mjs --apply
 *   node scripts/backfill-attribution.mjs --list-missing
 *
 * Env: DATABASE_URL
 * Data: scripts/backfill-attribution-data.json (or BACKFILL_JSON path)
 */
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDbIfNeeded, readState, writeState } from '../db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run') || (!args.has('--apply') && !args.has('--list-missing'));
const apply = args.has('--apply');
const listMissing = args.has('--list-missing');

function loadConfig() {
  const path = process.env.BACKFILL_JSON ?? join(__dirname, 'backfill-attribution-data.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

function attributionEntry(role, email) {
  return {
    role,
    memberEmail: email,
    platform: 'web',
    at: new Date().toISOString(),
  };
}

function listMissingAttribution(state) {
  const billsPaid = state.billsPaid ?? {};
  const attr = state.billPaymentAttribution ?? {};
  const amounts = state.billPaidAmounts ?? {};
  const rows = [];
  for (const [billId, keys] of Object.entries(billsPaid)) {
    for (const payKey of keys) {
      if (attr[billId]?.[payKey]?.role) continue;
      rows.push({
        billId,
        payKey,
        amount: amounts[billId]?.[payKey] ?? null,
      });
    }
  }
  return rows;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const cfg = loadConfig();
  const householdId = String(cfg.householdId ?? '').trim();
  if (!householdId) {
    console.error('householdId required in JSON');
    process.exit(1);
  }

  await initDbIfNeeded(console);
  const row = await readState(householdId);
  if (!row?.state) {
    console.error(`No finance_state for household_id=${householdId}`);
    process.exit(1);
  }

  const state = row.state;
  if (listMissing) {
    const missing = listMissingAttribution(state);
    console.log(`Missing bill attribution (${missing.length}):`);
    for (const m of missing) console.log(JSON.stringify(m));
    const surprises = (state.surpriseExpenses ?? []).filter((e) => !e.paidByRole);
    console.log(`Surprises without paidByRole (${surprises.length}):`);
    for (const s of surprises) console.log(JSON.stringify({ date: s.date, amount: s.amount, label: s.label }));
    return;
  }

  const billPaymentAttribution = { ...(state.billPaymentAttribution ?? {}) };
  let billUpdates = 0;
  for (const item of cfg.bills ?? []) {
    const { billId, payKey, role } = item;
    if (!billId || !payKey || (role !== 'owner' && role !== 'partner')) continue;
    const paidKeys = state.billsPaid?.[billId] ?? [];
    if (!paidKeys.includes(payKey)) {
      console.warn(`Skip bill ${billId}/${payKey}: not in billsPaid`);
      continue;
    }
    const email = role === 'owner' ? cfg.ownerEmail : cfg.partnerEmail;
    if (!billPaymentAttribution[billId]) billPaymentAttribution[billId] = {};
    if (billPaymentAttribution[billId][payKey]?.role === role) continue;
    billPaymentAttribution[billId][payKey] = attributionEntry(role, email);
    billUpdates += 1;
  }

  const surpriseExpenses = [...(state.surpriseExpenses ?? [])];
  let surpriseUpdates = 0;
  for (const item of cfg.surprises ?? []) {
    const match = item.match ?? {};
    const paidByRole = item.paidByRole;
    if (paidByRole !== 'owner' && paidByRole !== 'partner') continue;
    const idx = surpriseExpenses.findIndex(
      (e) =>
        e.date === match.date &&
        Math.abs(Number(e.amount) - Number(match.amount)) < 0.01 &&
        String(e.label).trim() === String(match.label).trim(),
    );
    if (idx < 0) {
      console.warn(`Skip surprise: no match for ${JSON.stringify(match)}`);
      continue;
    }
    if (surpriseExpenses[idx].paidByRole === paidByRole) continue;
    surpriseExpenses[idx] = { ...surpriseExpenses[idx], paidByRole };
    surpriseUpdates += 1;
  }

  console.log(`Bill attribution updates: ${billUpdates}`);
  console.log(`Surprise paidByRole updates: ${surpriseUpdates}`);

  if (dryRun && !apply) {
    console.log('Dry run — pass --apply to write.');
    return;
  }

  if (!apply) {
    console.log('Pass --apply to write.');
    return;
  }

  const next = { ...state, billPaymentAttribution, surpriseExpenses };
  const { updatedAt } = await writeState(householdId, next);
  console.log(`Wrote finance_state updated_at=${updatedAt}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
