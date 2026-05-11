FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache curl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.mjs ./
COPY templates.mjs ./
COPY snapshots.mjs ./
COPY db.mjs ./
COPY reminders.mjs ./

ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "index.mjs"]
