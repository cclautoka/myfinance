# Optional: build only the API from the `server/` directory, e.g.
#   docker build -f server/Dockerfile server
# Dokploy should use the **repository root** `Dockerfile` (SPA + API in one image) — see docs/dokploy-setup.md.
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY load-env.mjs password.mjs sessionToken.mjs index.mjs staticCache.mjs templates.mjs snapshots.mjs db.mjs financeStateDiff.mjs emptyFinanceState.mjs reminders.mjs reminderSend.mjs pushSend.mjs reminderCron.mjs mail.mjs notifyEmails.mjs ./
COPY copy ./copy
COPY scripts/db-migrate.mjs ./scripts/db-migrate.mjs
ENV NODE_ENV=production
EXPOSE 8787
CMD ["sh", "-c", "set -e && node scripts/db-migrate.mjs && exec node index.mjs"]
