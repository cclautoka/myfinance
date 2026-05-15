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

## Reminder email

**`POST /v1/reminders/send`** uses the stored snapshot and includes **due soon** (including grace), **overdue**, and **on the horizon** (unpaid bills due within the next 14 calendar days). The email is skipped when all three buckets are empty.

Keep **`REMINDER_EMAIL_HORIZON_CALENDAR_DAYS`** in `server/reminders.mjs` aligned with **`SAVE_EMAIL_BILL_HORIZON_CALENDAR_DAYS`** in `src/utils/reminderEmailPayloadClient.ts` when changing the horizon window.

**Due soon vs lead days:** “Closing in” / reminder **Due soon** counts **weekdays from tomorrow** through the bill’s due date (inclusive of the due date), up to your **Bill upcoming lead (business days)** setting in the app (default 3). **Due today** is classified as **overdue** for reminders and the bill strip.

**Cron / “today”:** `/v1/reminders/send` uses the server’s **`new Date()`** (the host’s local timezone). If your household is in another zone, “today” in the email may differ from your wall clock until you add a dedicated timezone (future enhancement).
