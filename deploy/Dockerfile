# syntax=docker/dockerfile:1
#
# Образ MusicLibrary для продакшену (multi-stage).
#   1) client-build — збирає React-клієнт (Vite) у client/dist;
#   2) runtime      — лише production-залежності сервера + client/dist.
# Один процес Node.js обслуговує і REST API (/api/*), і зібраний клієнт («монолітний бекенд» з ПЗ).
#
# Збірка з кореня репозиторію:
#   docker build -f deploy/Dockerfile -t music-library .
# (зазвичай образ збирає docker compose -f deploy/docker-compose.prod.yml up -d --build)

ARG NODE_VERSION=24

# ---------- 1. Збірка клієнта ----------
FROM node:${NODE_VERSION}-bookworm-slim AS client-build
WORKDIR /app

# Спершу лише маніфести — шар із залежностями кешується, поки вони не змінюються.
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
# --ignore-scripts: скрипти встановлення залежностей не виконуються (жодна з клієнтських їх не потребує).
RUN npm ci --workspace client --ignore-scripts --no-audit --no-fund

COPY client/ client/
RUN npm run build --workspace client

# ---------- 2. Робочий образ ----------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
# --ignore-scripts: скрипти встановлення не виконуються; явно перезбирається лише bcrypt —
# нативний модуль, якому потрібен його скрипт install (node-gyp-build).
RUN npm ci --workspace server --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm rebuild bcrypt \
    && npm cache clean --force

COPY database/ database/
COPY server/src/ server/src/
COPY server/scripts/ server/scripts/
COPY --from=client-build /app/client/dist/ client/dist/

# Процес працює від непривілейованого користувача node (є в офіційному образі).
USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

# Змінні середовища передає docker compose (env_file), тому без --env-file.
CMD ["node", "server/src/server.js"]
