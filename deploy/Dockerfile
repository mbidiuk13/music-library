#syntax=docker/dockerfile:1

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS client-build
WORKDIR /app

#спершу лише маніфести — шар із залежностями кешується, поки вони не змінюються
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
#скрипти встановлення залежностей не потрібні жодній клієнтській залежності
RUN npm ci --workspace client --ignore-scripts --no-audit --no-fund

COPY client/ client/
RUN npm run build --workspace client

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
#скрипти встановлення вимкнено; перезбирається лише bcrypt — нативному модулю потрібен install
RUN npm ci --workspace server --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm rebuild bcrypt \
    && npm cache clean --force

COPY database/ database/
COPY server/src/ server/src/
COPY server/scripts/ server/scripts/
COPY --from=client-build /app/client/dist/ client/dist/

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

#змінні середовища передає docker compose (env_file), тому без --env-file
CMD ["node", "server/src/server.js"]
