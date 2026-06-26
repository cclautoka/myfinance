# Single Dokploy service: Vite SPA (static) + notify API in one Node process.
FROM node:22-alpine AS frontend-build
WORKDIR /web
# Dokploy / CI: pass commit SHA + build number so the header is not stuck on "DEV".
ARG DOKPLOY_GIT_SHA=""
ARG DOKPLOY_BUILD_NUMBER=""
ARG GITHUB_SHA=""
ARG GITHUB_RUN_NUMBER=""
ENV DOKPLOY_GIT_SHA=$DOKPLOY_GIT_SHA \
    DOKPLOY_BUILD_NUMBER=$DOKPLOY_BUILD_NUMBER \
    GITHUB_SHA=$GITHUB_SHA \
    GITHUB_RUN_NUMBER=$GITHUB_RUN_NUMBER \
    DOCKER_BUILD=1 \
    CI=true
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN node scripts/bump-patch-version.mjs --ci
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
COPY server/scripts/seed-fresh-start.mjs ./scripts/seed-fresh-start.mjs
COPY server/scripts/fresh-start-state.mjs ./scripts/fresh-start-state.mjs
COPY --from=frontend-build /web/dist ./public
ENV NODE_ENV=production
EXPOSE 8787
# 1) Apply Postgres schema (fatal if DB misconfigured). 2) Optional one-time fresh-start seed —
#    no-op unless SEED_FRESH_START=1, and non-fatal so it never blocks boot. 3) Start the server.
CMD ["sh", "-c", "set -e && node scripts/db-migrate.mjs && (node scripts/seed-fresh-start.mjs || echo 'seed:fresh-start skipped (non-fatal)') && exec node index.mjs"]
