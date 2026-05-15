#!/usr/bin/env node
/**
 * Mark household member(s) as email-verified (admin / migration).
 *
 * Usage:
 *   EMAIL=you@example.com node scripts/mark-email-verified.mjs
 *   HOUSEHOLD_ID=61c575... EMAIL=you@example.com CONFIRM=1 node scripts/mark-email-verified.mjs
 */
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const email = (process.env.EMAIL ?? '').trim().toLowerCase();
const householdId = (process.env.HOUSEHOLD_ID ?? '').trim().slice(0, 64);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  if (!email) {
    console.error('Set EMAIL=…');
    process.exit(1);
  }
  if (process.env.CONFIRM !== '1') {
    console.error(`Dry run. Re-run with CONFIRM=1 to mark verified.\n  EMAIL=${email}${householdId ? `\n  HOUSEHOLD_ID=${householdId}` : ''}`);
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const r = householdId
      ? await pool.query(
          `update household_member set email_verified_at = coalesce(email_verified_at, now())
           where lower(email) = lower($1) and household_id = $2
           returning household_id, email, email_verified_at`,
          [email, householdId],
        )
      : await pool.query(
          `update household_member set email_verified_at = coalesce(email_verified_at, now())
           where lower(email) = lower($1)
           returning household_id, email, email_verified_at`,
          [email],
        );
    if (r.rowCount === 0) {
      console.error('No matching member found.');
      process.exit(1);
    }
    for (const row of r.rows) {
      console.log(`verified  ${row.household_id}  ${row.email}  at=${row.email_verified_at}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
