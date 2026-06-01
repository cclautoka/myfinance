# Dokploy: host app + notify API (one service)

The repo root **`Dockerfile`** builds the **Vite SPA** and the **`server/`** Node app into **one image**: Fastify serves `dist/` as static files and exposes **`POST /v1/notify`** on the **same origin** (so you can use notify URL **`/v1/notify`** in the app). The container runs **`node scripts/db-migrate.mjs`** before **`node index.mjs`** so Postgres tables exist on every deploy.

## Dokploy application

1. **New application** → your Git repository.
2. **Build type**: Dockerfile (repo root).
3. **Dockerfile path**: `Dockerfile` (default).
4. **Context**: repository root (default).
5. **Port**: map your public HTTPS port to container **`8787`** (or set env `PORT` and match it).

## Environment variables

See `server/env.example`. Typical production:

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | **Required** for server-backed state + household auth. |
| `SESSION_SECRET` | **16+ chars** — required for `fm_sess_…` sign-in. |
| `NOTIFY_LEGACY_SECRET_DISABLED` | Set to `1` when you no longer use legacy `NOTIFY_API_SECRET`. |
| `NOTIFY_API_SECRET` | Legacy bearer only (≥16 chars); omit if disabled above. |
| `NOTIFY_TO` | Optional legacy fallback recipients. |
| `NOTIFY_CORS_ORIGINS` | Leave empty for same-origin SPA + API; otherwise comma-separated UI origins. |
| `RESEND_*` or `SMTP_*` | One mail transport for summaries / magic links. |

## After deploy

1. Open your Dokploy URL in the browser (the SPA).
2. **Tools & alerts** → **Notify API URL**: use **`/v1/notify`** (same host) unless you run the API elsewhere.
3. **Shared secret** only if you still use **`NOTIFY_API_SECRET`**; otherwise use **Household sign-in** + **`SESSION_SECRET`**. Enable summaries, **Send test email**.

## Health check

Use **`GET /health`** → `{ "ok": true }`.

## Local Docker

```bash
docker build -t household-finance:local .
docker run --rm -p 8787:8787 \
  -e DATABASE_URL=postgres://user:pass@host:5432/dbname \
  -e SESSION_SECRET=your-session-secret-min-16-chars \
  -e NOTIFY_LEGACY_SECRET_DISABLED=1 \
  -e NOTIFY_TO=you@example.com \
  -e RESEND_API_KEY=... -e RESEND_FROM="App <onboarding@resend.dev>" \
  household-finance:local
```

Then visit `http://localhost:8787`.

## Save email payload (`digest`)

After a quiet period following edits, the SPA may POST **`digest`** (`version: 1`) with structured **sections** (field-level diff, cash snapshot, bills heads-up). The server still accepts a legacy plain-text **`summary`** only. Bodies larger than ~28KB are rejected.

Preview HTML locally: **`GET /preview/email?kind=digest`** (also `kind=change` and `kind=reminder`).

## Reminder email vs push

**Daily cron (default 7:00, `REMINDER_CRON_TIMEZONE`, usually `Pacific/Fiji`):**

| Channel | When it sends | Content |
|---------|----------------|---------|
| **Email** | Only if there is something to say | **Due today** (unpaid bills due on that calendar day) plus **overdue reminders** on a cadence: 3 days after grace ends, then 7, then every 7 days (14, 21, …). |
| **App push** (if enabled) | Every cron run with any heads-up | Full daily summary: due soon (incl. grace), overdue, and coming up (14-day horizon). Wording only; schedule unchanged. |

Email is skipped when both **due today** and **overdue cadence** buckets are empty. Push still sends when any daily bucket is non-empty.

Keep **`REMINDER_EMAIL_HORIZON_CALENDAR_DAYS`** in `server/reminders.mjs` aligned with **`SAVE_EMAIL_BILL_HORIZON_CALENDAR_DAYS`** in `src/utils/reminderEmailPayloadClient.ts` for push/widget horizons.

**Cron / “today”:** due-today email uses the cron timezone’s calendar date (`REMINDER_CRON_TIMEZONE`).

## Automatic daily reminders (hosted default)

When **`DATABASE_URL`** and **`REMINDER_CRON_ENABLED=1`** are set, the Node server schedules daily reminders **in-process** on boot. **End users do not configure cron or API keys.**

| Variable | Default | Purpose |
|----------|---------|---------|
| `REMINDER_CRON_ENABLED` | `1` (set in production) | Start in-process scheduler |
| `REMINDER_CRON_EXPRESSION` | `0 7 * * *` | Cron syntax |
| `REMINDER_CRON_TIMEZONE` | `Pacific/Fiji` | Schedule timezone |

Each run fans out to **every** row in **`finance_state`**, uses bill data from snapshot or Postgres state, and sends to owner/partner login emails (or snapshot / `NOTIFY_TO` fallback). A Postgres advisory lock ensures only one replica sends if you scale containers.

**Operator checklist after deploy:**

1. Set `REMINDER_CRON_ENABLED=1` (and `DATABASE_URL`, mail env).
2. **Remove** any old Dokploy schedule that called `/v1/reminders/send` with `NOTIFY_API_SECRET` (it returns **401** when legacy auth is disabled).
3. Optional manual test: `POST /v1/reminders/send-all` with `Authorization: Bearer $REMINDER_CRON_SECRET` (min 16 chars).

### Change-summary emails (browser)

After edits, the browser POSTs **`/v1/notify`** after **~60s** debounce. Summaries default **on** once sign-in emails are known. Users can turn them off in **Tools & alerts**. Failures show a toast.

---

## Self-hosted appendix (external Dokploy cron)

Only if you disable in-process cron (`REMINDER_CRON_ENABLED=0`):

- Per-household **`hk_…`** key: **Tools & alerts** → **Self-hosted / advanced**, or `npm run server:create-cron-key -- HOUSEHOLD_ID`.
- Multi-household shell: [`docs/dokploy-daily-reminders.sh.example`](dokploy-daily-reminders.sh.example).
- Single-household: `POST /v1/reminders/send` with `hk_…` bearer (not `NOTIFY_API_SECRET` when `NOTIFY_LEGACY_SECRET_DISABLED=1`).
