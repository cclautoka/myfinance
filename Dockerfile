# Single Dokploy service: Vite SPA (static) + notify API in one Node process.
FROM node:22-alpine AS frontend-build
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache curl
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/load-env.mjs ./
COPY server/password.mjs ./
COPY server/sessionToken.mjs ./
COPY server/index.mjs ./
COPY server/staticCache.mjs ./
COPY server/copy ./copy
COPY server/templates.mjs ./templates.mjs
COPY server/snapshots.mjs ./snapshots.mjs
COPY server/db.mjs ./db.mjs
COPY server/financeStateDiff.mjs ./financeStateDiff.mjs
COPY server/emptyFinanceState.mjs ./emptyFinanceState.mjs
COPY server/reminders.mjs ./reminders.mjs
COPY server/mail.mjs ./mail.mjs
COPY server/notifyEmails.mjs ./notifyEmails.mjs
COPY server/reminderSend.mjs ./reminderSend.mjs
COPY server/pushSend.mjs ./pushSend.mjs
COPY server/reminderCron.mjs ./reminderCron.mjs
COPY server/scripts/db-migrate.mjs ./scripts/db-migrate.mjs
COPY --from=frontend-build /web/dist ./public
ENV NODE_ENV=production
EXPOSE 8787
# Apply Postgres schema before listen (no-op if DATABASE_URL unset). Same DDL as initDb on boot — ensures deploy fails fast if DB is misconfigured.
CMD ["sh", "-c", "set -e && node scripts/db-migrate.mjs && exec node index.mjs"]
