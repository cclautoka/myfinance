# Dokploy: host app + notify API (one service)

The repo root **`Dockerfile`** builds the **Vite SPA** and the **`server/`** Node app into **one image**: Fastify serves `dist/` as static files and exposes **`POST /v1/notify`** on the **same origin** (so you can use notify URL **`/v1/notify`** in the app).

## Dokploy application

1. **New application** → your Git repository.
2. **Build type**: Dockerfile (repo root).
3. **Dockerfile path**: `Dockerfile` (default).
4. **Context**: repository root (default).
5. **Port**: map your public HTTPS port to container **`8787`** (or set env `PORT` and match it).

## Environment variables

See `server/env.example`. Minimum for email:

| Variable | Notes |
|----------|--------|
| `NOTIFY_API_SECRET` | ≥16 chars; paste the same value in the app (**Tips & backup**). |
| `NOTIFY_TO` | Recipient. |
| `NOTIFY_CORS_ORIGINS` | Optional if browser and API share the **same** origin (single service). Set to your site origin(s) if you split frontend/API later. |
| `RESEND_*` or `SMTP_*` | One mail transport (see `server/env.example`). |

## After deploy

1. Open your Dokploy URL in the browser (the SPA).
2. **Tips & backup** → **Notify API URL**: use **`/v1/notify`** (same host) unless you run the API elsewhere.
3. Set **Shared secret**, enable summaries, **Send test email**.

## Health check

Use **`GET /health`** → `{ "ok": true }`.

## Local Docker

```bash
docker build -t household-finance:local .
docker run --rm -p 8787:8787 \
  -e NOTIFY_API_SECRET=your-long-secret-here-min-16 \
  -e NOTIFY_TO=you@example.com \
  -e RESEND_API_KEY=... -e RESEND_FROM="App <onboarding@resend.dev>" \
  household-finance:local
```

Then visit `http://localhost:8787`.
