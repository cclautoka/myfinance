#!/usr/bin/env node
/**
 * List households, owner emails, and finance_state timestamps (read-only audit).
 *
 * Usage: cd server && node scripts/list-households.mjs
 */
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const members = await pool.query(
      `select household_id, email, role, email_verified_at, created_at
       from household_member
       order by household_id, role, email`,
    );
    const states = await pool.query(
      `select household_id, updated_at from finance_state order by household_id`,
    );
    const stateByHid = new Map(states.rows.map((r) => [r.household_id, r.updated_at]));

    console.log('--- household_member ---');
    for (const r of members.rows) {
      console.log(
        `${r.household_id}  ${r.role.padEnd(8)}  ${r.email}  verified=${r.email_verified_at ? 'yes' : 'no'}  state_updated=${stateByHid.get(r.household_id) ?? '—'}`,
      );
    }
    console.log(`\nTotal members: ${members.rowCount}`);
    console.log(`Total finance_state rows: ${states.rowCount}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
