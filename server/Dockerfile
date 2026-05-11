FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.mjs ./
COPY templates.mjs ./
COPY snapshots.mjs ./
COPY db.mjs ./

ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "index.mjs"]
