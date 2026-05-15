#!/usr/bin/env node
/**
 * Move auth member from REMOVE_HID → KEEP_HID, delete REMOVE finance_state + household row.
 *
 * Usage:
 *   KEEP_HID=61c575... REMOVE_HID=81c575... node scripts/consolidate-household.mjs
 *   CONFIRM=1 …  # required to apply
 */
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const KEEP_HID = (process.env.KEEP_HID ?? '61c575ad5352b15bbb964349ed258cd6').trim().slice(0, 64);
const REMOVE_HID = (process.env.REMOVE_HID ?? '81c575ad5352b15bbb964349ed258cd8').trim().slice(0, 64);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  if (KEEP_HID === REMOVE_HID) {
    console.error('KEEP_HID and REMOVE_HID must differ.');
    process.exit(1);
  }
  if (process.env.CONFIRM !== '1') {
    console.error(`Dry run only. Re-run with CONFIRM=1 to apply.\n  KEEP_HID=${KEEP_HID}\n  REMOVE_HID=${REMOVE_HID}`);
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('begin');

    const moved = await client.query(
      `update household_member set household_id = $1 where household_id = $2 returning id, email, role`,
      [KEEP_HID, REMOVE_HID],
    );
    if (moved.rowCount === 0) {
      throw new Error(`No household_member rows on REMOVE_HID=${REMOVE_HID}`);
    }
    console.log(`Moved ${moved.rowCount} member(s) to ${KEEP_HID}:`, moved.rows);

    const delState = await client.query(`delete from finance_state where household_id = $1 returning household_id`, [
      REMOVE_HID,
    ]);
    console.log(`Deleted finance_state: ${delState.rowCount} row(s)`, delState.rows.map((r) => r.household_id));

    const delHouse = await client.query(`delete from household where household_id = $1 returning household_id`, [
      REMOVE_HID,
    ]);
    console.log(`Deleted household row: ${delHouse.rowCount} row(s)`);

    await client.query(`insert into household (household_id) values ($1) on conflict (household_id) do nothing`, [
      KEEP_HID,
    ]);

    await client.query('commit');
    console.log('Done.');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
