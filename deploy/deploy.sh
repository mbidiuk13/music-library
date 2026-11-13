#!/usr/bin/env bash
#запуск з кореня клону (.env заповнено, DNS домену вказує на сервер):
#sudo DOMAIN=music.example.com LETSENCRYPT_EMAIL=you@example.com ./deploy/deploy.sh

set -euo pipefail

: "${DOMAIN:?Вкажіть домен: DOMAIN=music.example.com}"
: "${LETSENCRYPT_EMAIL:?Вкажіть пошту для сертифіката HTTPS: LETSENCRYPT_EMAIL=you@example.com}"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

COMPOSE=(docker compose --env-file .env -f deploy/docker-compose.prod.yml)
NGINX_SITE=/etc/nginx/sites-available/music-library

log() { printf '\n==> %s\n' "$*"; }

if [[ $EUID -ne 0 ]]; then
  echo "Запустіть скрипт через sudo." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Немає файлу .env. Скопіюйте .env.example у .env і заповніть значення (див. README.md)." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  log "Встановлення Docker"
  apt-get update
  apt-get install -y docker.io docker-compose-v2
  systemctl enable --now docker
fi

if ! command -v nginx >/dev/null 2>&1 || ! command -v certbot >/dev/null 2>&1; then
  log "Встановлення nginx і certbot"
  apt-get update
  apt-get install -y nginx certbot
  systemctl enable --now nginx
fi

log "Оновлення коду (git pull)"
if [[ -n "${SUDO_USER:-}" ]]; then
  sudo -u "$SUDO_USER" git pull --ff-only
else
  git pull --ff-only
fi

log "Збірка образу і запуск контейнерів"
"${COMPOSE[@]}" up -d --build --remove-orphans

#БД ініціалізується лише при першому розгортанні (таблиці users ще немає).
#shellcheck disable=SC2016  # змінні розкриваються всередині контейнера postgres
schema_exists="$("${COMPOSE[@]}" exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT to_regclass('"'"'public.users'"'"') IS NOT NULL"')"

if [[ "$schema_exists" != "t" ]]; then
  log "Перше розгортання: схема БД, медіатека, адміністратор"
  "${COMPOSE[@]}" exec -T app node server/src/db/migrate.js
  "${COMPOSE[@]}" exec -T app node server/src/db/seed.js
  "${COMPOSE[@]}" exec -T app node server/src/db/seed-admin.js

  if compgen -G "server/media/*.mp3" >/dev/null; then
    log "Завантаження аудіофайлів з server/media/ у S3"
    "${COMPOSE[@]}" run --rm -v "$REPO_DIR/server/media:/app/server/media:ro" app \
      node server/scripts/import-tracks.js
  fi
else
  log "Схема БД уже існує — ініціалізацію пропущено"
fi

if [[ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  log "Отримання сертифіката Let's Encrypt для $DOMAIN"
  #standalone займає порт 80, тому nginx на цей час зупиняється; хуки діють і при автопоновленні
  certbot certonly --standalone --non-interactive --agree-tos \
    -m "$LETSENCRYPT_EMAIL" -d "$DOMAIN" \
    --pre-hook "systemctl stop nginx" --post-hook "systemctl start nginx"
fi

log "Налаштування nginx"
sed "s/__DOMAIN__/$DOMAIN/g" deploy/nginx.conf > "$NGINX_SITE"
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/music-library
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

log "Готово: https://$DOMAIN"
"${COMPOSE[@]}" ps
