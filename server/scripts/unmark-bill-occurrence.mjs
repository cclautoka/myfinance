#!/usr/bin/env node
/**
 * Remove one handled bill occurrence from finance_state (undo mistaken mark).
 *
 * Usage (from server/):
 *   node scripts/unmark-bill-occurrence.mjs --household-id=ID --bill-id=food --pay-key=2026-06-13
 *   node scripts/unmark-bill-occurrence.mjs --apply  (uses HOUSEHOLD_ID from .env)
 *
 * Env: DATABASE_URL, optional HOUSEHOLD_ID
 */
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDbIfNeeded, readState, writeState } from '../db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

const apply = process.argv.includes('--apply');
const householdId = arg('household-id') ?? process.env.HOUSEHOLD_ID?.trim();
const billId = arg('bill-id') ?? 'food';
const payKey = arg('pay-key') ?? '2026-06-13';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  if (!householdId) {
    console.error('Set --household-id= or HOUSEHOLD_ID in .env');
    process.exit(1);
  }

  await initDbIfNeeded(console);
  const row = await readState(householdId);
  if (!row?.state) {
    console.error(`No finance_state for household_id=${householdId}`);
    process.exit(1);
  }

  const state = row.state;
  const paid = state.billsPaid?.[billId] ?? [];
  if (!paid.includes(payKey)) {
    console.log(`Already unmarked: ${billId} / ${payKey}`);
    process.exit(0);
  }

  state.billsPaid = {
    ...(state.billsPaid ?? {}),
    [billId]: paid.filter((k) => k !== payKey),
  };
  if (state.billsPaid[billId].length === 0) delete state.billsPaid[billId];

  const prevAmount = state.billPaidAmounts?.[billId]?.[payKey];
  const amounts = { ...(state.billPaidAmounts?.[billId] ?? {}) };
  delete amounts[payKey];
  state.billPaidAmounts = { ...(state.billPaidAmounts ?? {}) };
  if (Object.keys(amounts).length) state.billPaidAmounts[billId] = amounts;
  else delete state.billPaidAmounts[billId];

  const attr = { ...(state.billPaymentAttribution?.[billId] ?? {}) };
  delete attr[payKey];
  state.billPaymentAttribution = { ...(state.billPaymentAttribution ?? {}) };
  if (Object.keys(attr).length) state.billPaymentAttribution[billId] = attr;
  else delete state.billPaymentAttribution[billId];

  console.log(`Will unmark ${billId} payKey=${payKey}${prevAmount != null ? ` (was $${prevAmount})` : ''}`);

  if (!apply) {
    console.log('Dry run — pass --apply to write.');
    return;
  }

  const r = await writeState(householdId, state);
  console.log(`Updated finance_state updated_at=${r.updatedAt}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
