#!/usr/bin/env node
/**
 * Create an hk_* bearer key for Dokploy daily reminder cron (server-side ops).
 *
 * Usage:
 *   cd server && node scripts/create-cron-bearer-key.mjs HOUSEHOLD_ID [label]
 *
 * Requires DATABASE_URL. Prints the raw key once — store in Dokploy secrets.
 */
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

function hashUtf8Sha256Hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

async function main() {
  const householdId = (process.argv[2] ?? '').trim().slice(0, 64);
  const label = (process.argv[3] ?? 'dokploy-daily-reminders').trim().slice(0, 80);
  if (!householdId) {
    console.error('Usage: node scripts/create-cron-bearer-key.mjs HOUSEHOLD_ID [label]');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const raw = `hk_${crypto.randomBytes(24).toString('hex')}`;
  const tokenHash = hashUtf8Sha256Hex(raw);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const check = await pool.query(`select 1 from finance_state where household_id = $1 limit 1`, [
      householdId,
    ]);
    if (check.rowCount === 0) {
      console.warn(`Warning: no finance_state row for household_id=${householdId}`);
    }
    const ins = await pool.query(
      `insert into household_bearer_key (household_id, token_hash, label)
       values ($1, $2, $3)
       returning id, created_at`,
      [householdId, tokenHash, label],
    );
    const row = ins.rows[0];
    console.log('--- cron bearer key (save now; shown once) ---');
    console.log(`household_id: ${householdId}`);
    console.log(`key_id:       ${row.id}`);
    console.log(`created_at:   ${row.created_at}`);
    console.log(`key:          ${raw}`);
    console.log('');
    console.log('Dokploy curl (single household):');
    console.log(
      `curl -sS -X POST "http://127.0.0.1:8787/v1/reminders/send" -H "Authorization: Bearer ${raw}" -H "Content-Type: application/json" -d '{"id":"${householdId}"}'`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
