# Data safety checklist (self-hosted)

Before running migrations or deploying auth changes:

1. **`pg_dump`** your database (at minimum table `finance_state`):

   ```bash
   pg_dump "$DATABASE_URL" -Fc -f finance-backup-$(date +%Y%m%d).dump
   ```

2. **Snapshot files** — if you use file-based reminders (`SNAPSHOT_DIR` / `data/*.json`), copy that directory.

3. **Smoke test after deploy**

   - `GET /health` → `{ ok: true }`
   - Existing client with `NOTIFY_API_SECRET` can still `GET /v1/state?id=...`
   - Register primary on a test household, then `PUT /v1/state` with session bearer.

4. **Rollback** — restore dump; drop new tables only if you need to revert schema (not required for forward-only additive DDL).
