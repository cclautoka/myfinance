# Dokploy setup (Household finances)

This app is one **Docker** service: the **Vite UI** and **`POST /v1/notify`** API run together on port **8787**. Source: [github.com/cclautoka/myfinance](https://github.com/cclautoka/myfinance).

---

## 0. Prerequisites

- A server with **Dokploy** already installed (your VPS + Dokploy URL).
- This repo pushed to GitHub (**`main`** branch).
- (Optional, for email) A [Resend](https://resend.com) account + API key **or** SMTP details for your mail provider.

---

## 1. Create the application in Dokploy

UI names can vary slightly by Dokploy version; the idea is the same.

1. Open your **Dokploy dashboard**.
2. Pick or create a **Project** (e.g. `personal`).
3. **Create application** (or **Add service** → **Application**).
4. **Source**: **GitHub** (install Dokploy’s GitHub App if prompted, or use SSH / deploy key for private repos).  
   - Repository: **`cclautoka/myfinance`**  
   - Branch: **`main`**
5. **Build type**: **Dockerfile** (not Nixpacks).
6. **Dockerfile path**: **`Dockerfile`** (repo root).
7. **Docker context**: **`.`** (repository root — same folder as that Dockerfile).
8. Save / continue so Dokploy can clone and build.

---

## 2. Container port (critical)

The Node process listens on **`8787`** inside the container.

- In the app’s **Ports** / **Networking** section, set the **container port** to **`8787`**.
- Map it to the port Traefik/Dokploy expects (often **8787 → 8787**, or “published” **80** → **8787** depending on your template).  
- **Rule:** traffic from your **public domain** must reach the process on **8787** in the container.

If Dokploy has a single **“Port”** field, use **`8787`**.

---

## 3. Domain & HTTPS

1. Open **Domains** (or **Traefik** / **URL**) for this application.
2. Add your hostname, e.g. **`finances.yourdomain.com`**.
3. Enable **HTTPS** (Let’s Encrypt) if Dokploy offers it.
4. Point DNS: an **A record** (or **CNAME**) for that hostname to your **server’s public IP** (same as Dokploy).

Wait until DNS resolves before expecting SSL to succeed.

---

## 4. Environment variables

Open **Environment** for this application and add at least:

| Name | Example | Purpose |
|------|---------|---------|
| `NODE_ENV` | `production` | Standard Node production mode. |
| `NOTIFY_API_SECRET` | `paste-a-long-random-string-at-least-16-chars` | Same value you type in the app under **Tips & backup → Shared secret**. |
| `NOTIFY_TO` | `you@gmail.com` | Where change-summary emails go. |

**Email (pick one path):**

**A — Resend (easiest)**  
| `RESEND_API_KEY` | From Resend dashboard |  
| `RESEND_FROM` | Verified sender, e.g. `Household <onboarding@resend.dev>` |

**B — SMTP (if `RESEND_API_KEY` is empty)**  
| `SMTP_HOST` | your SMTP host |  
| `SMTP_PORT` | `587` |  
| `SMTP_SECURE` | `false` (usually for 587) |  
| `SMTP_USER` / `SMTP_PASS` | if required |  
| `MAIL_FROM` | e.g. `Household <noreply@yourdomain.com>` |

**CORS (optional for this single-host setup)**  
| `NOTIFY_CORS_ORIGINS` | Leave **empty** if the browser URL is the **same** origin as the API (one Dokploy app). If you split frontend/API later, set comma-separated origins, e.g. `https://finances.yourdomain.com`. |

See also: `server/env.example` in the repo.

---

## 5. Health check (recommended)

If Dokploy asks for a health check:

- **Path:** `/health`  
- **Port:** `8787` (same as the app)

Success response: JSON `{"ok":true}`.

---

## 6. Deploy

1. Click **Deploy** / **Rebuild** (first build runs `npm ci` + Vite build + server install — can take **several minutes**).
2. Open **Build logs** if it fails (common issues: out-of-memory on small VPS — upgrade RAM or add swap; or Git clone/auth errors).

---

## 7. After it’s green

1. Visit **`https://finances.yourdomain.com`** (your domain). You should see the **Household finances** UI.
2. **Tips & backup** → **Email heads-up**  
   - **Notify API URL:** **`/v1/notify`**  
   - **Shared secret:** same as **`NOTIFY_API_SECRET`**  
   - Enable **Send email summaries after changes**  
   - **Send test email** — check inbox/spam.

---

## 8. Troubleshooting

| Symptom | What to check |
|---------|----------------|
| 502 / blank page | Port mapping → container **8787**; build logs for failed `npm run build`. |
| Site loads, test email fails | `RESEND_*` or `SMTP_*` + `NOTIFY_TO`; Resend: domain/sender verified. |
| Browser console CORS on `/v1/notify` | Same host should avoid CORS; if you use a different API URL, set **`NOTIFY_CORS_ORIGINS`** to your exact UI origin (including `https://`). |
| Email only after ~60s of no edits | By design: summaries are **debounced** so typing doesn’t spam you. |

---

## 9. Updating the app

Push to **`main`** on GitHub, then in Dokploy **Redeploy** / enable **auto-deploy on push** if your template supports it.
