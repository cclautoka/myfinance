# Single Dokploy service: Vite SPA (static) + notify API in one Node process.
FROM node:22-alpine AS frontend-build
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/index.mjs ./
COPY --from=frontend-build /web/dist ./public
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "index.mjs"]
