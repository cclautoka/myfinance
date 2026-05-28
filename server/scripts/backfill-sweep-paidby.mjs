import { initDbIfNeeded, getDbEnabled, readState, writeState } from '../db.mjs';

function parseArgs(argv) {
  const out = { apply: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--household') out.householdId = argv[++i];
    else if (a === '--amount') out.amount = Number(argv[++i]);
    else if (a === '--month') out.monthKey = String(argv[++i]);
    else if (a === '--role') out.role = String(argv[++i]);
  }
  return out;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function main() {
  const args = parseArgs(process.argv);
  const householdId = String(args.householdId ?? '').trim();
  const amount = round2(Number(args.amount));
  const monthKey = String(args.monthKey ?? '').trim();
  const role = args.role === 'partner' ? 'partner' : 'owner';

  if (!householdId) throw new Error('--household required');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('--amount required');
  if (!monthKey) throw new Error('--month required (YYYY-MM)');

  await initDbIfNeeded(console);
  if (!getDbEnabled()) throw new Error('DATABASE_URL not set');

  const existing = await readState(householdId);
  if (!existing?.state) throw new Error(`No finance_state for household=${householdId}`);

  const state = existing.state;
  const sweeps = Array.isArray(state.budgetSurplusSweeps) ? state.budgetSurplusSweeps : [];

  let changed = 0;
  const nextSweeps = sweeps.map((s) => {
    if (String(s.monthKey ?? '') !== monthKey) return s;
    const amt = round2(Number(s.amount));
    if (!Number.isFinite(amt) || amt !== amount) return s;
    if (s.paidByRole === role) return s;
    changed++;
    return { ...s, paidByRole: role };
  });

  if (!changed) {
    console.log('No matching sweep rows found to update.');
    return;
  }

  const nextState = { ...state, budgetSurplusSweeps: nextSweeps };
  console.log(`Would update ${changed} sweep row(s) to paidByRole=${role}.`);

  if (!args.apply) {
    console.log('Dry run only. Re-run with --apply to write.');
    return;
  }

  const r = await writeState(householdId, nextState);
  console.log(`Updated finance_state updated_at=${r.updatedAt}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

