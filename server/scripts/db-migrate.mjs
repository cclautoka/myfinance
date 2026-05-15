#!/usr/bin/env node
/**
 * Apply Postgres schema (same as server boot + `initDbIfNeeded`) and verify core tables.
 *
 *   cd server && npm run db:migrate
 *
 * Requires DATABASE_URL in `.env` or the environment. If DATABASE_URL is unset, exits 0 with a skip message.
 */
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCoreTables, withDb } from '../db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.log('db:migrate — DATABASE_URL not set; nothing to do.');
    process.exit(0);
  }

  const check = await assertCoreTables(console);
  if (!check.ok) {
    console.error('db:migrate — schema incomplete:', check.missing);
    process.exit(1);
  }

  const counts = await withDb(async (pool) => {
    const r = await pool.query(`
      select
        (select count(*)::int from finance_state) as finance_state,
        (select count(*)::int from household_member) as household_member,
        (select count(*)::int from household) as household
    `);
    return r.rows[0];
  });

  console.log('db:migrate — OK');
  console.log('  tables:', check.found.join(', '));
  console.log('  row counts:', counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
