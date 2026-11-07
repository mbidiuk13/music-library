# MusicLibrary — Бібліотека музичних творів

Односторінковий (SPA) веб-застосунок для потокового прослуховування музики.

- **Гість** бачить Топ-100, шукає й слухає треки, може зареєструватися, увійти чи відновити пароль.
- **Користувач** додатково має плейлисти, «Улюблені» і персональні рекомендації (косинусна подібність векторів треків).
- **Адміністратор** у закритій адмін-панелі завантажує аудіо в AWS S3, редагує метадані і видаляє треки.

Музика не переривається під час переходів між сторінками: плеєр живе поза маршрутизатором.

## Зміст

1. [Технології](#технології)
2. [Структура репозиторію](#структура-репозиторію)
3. [Вимоги](#вимоги)
4. [Встановлення](#встановлення)
5. [Налаштування `.env`](#налаштування-env)
6. [База даних: міграції та наповнення](#база-даних-міграції-та-наповнення)
7. [Аудіофайли: `import:tracks`](#аудіофайли-importtracks)
8. [Запуск у режимі розробки](#запуск-у-режимі-розробки)
9. [Тести і перевірка коду](#тести-і-перевірка-коду)
10. [Postman-колекція](#postman-колекція)
11. [Продакшен-збірка локально](#продакшен-збірка-локально)
12. [Розгортання на сервері](#розгортання-на-сервері)
13. [Команди npm](#команди-npm)
14. [Типові проблеми](#типові-проблеми)

## Технології

| Шар | Технологія |
|---|---|
| Сервер | Node.js 20+, Express 4, `pg` (без ORM), `jsonwebtoken`, `bcrypt`, `express-validator`, `multer`, `helmet`, `nodemailer` |
| Рекомендації | `mathjs` (косинусна подібність) |
| Клієнт | React 18, React Router 6, `i18next` / `react-i18next`, Vite |
| БД | PostgreSQL 15+ (5 таблиць, 3НФ, trigram-індекси для пошуку) |
| Файли | AWS S3 (приватний бакет, відтворення за pre-signed URL), AWS SDK for JavaScript v3 |
| Тести | Jest + Supertest |
| Розгортання | Docker, Docker Compose, nginx, Let's Encrypt (certbot) |

## Структура репозиторію

```
music-library/
├── server/                 # REST API (Express)
│   ├── src/
│   │   ├── modules/        # auth — Auth Controller, media — Media Service,
│   │   │                   # playlists — Playlist Service, recommendations — Recommendation Engine
│   │   ├── middleware/     # автентифікація, RBAC, валідація, завантаження файлів, заголовки безпеки
│   │   ├── services/       # клієнт S3, надсилання листів
│   │   ├── db/             # пул з'єднань, migrate, seed, seed:admin
│   │   └── config/         # конфігурація з .env, словники жанрів/настроїв/тональностей
│   ├── scripts/            # import-tracks.js
│   └── tests/              # автоматичні тести (Jest + Supertest)
├── client/                 # SPA (React + Vite); тексти інтерфейсу — client/src/i18n/locales/uk.json
├── database/               # schema.sql (схема БД), seed.sql (50 треків медіатеки)
├── deploy/                 # Dockerfile, docker-compose.prod.yml, nginx.conf, deploy.sh, налаштування S3
├── postman/collections/    # Postman-колекція з усіма запитами API
├── docker-compose.dev.yml  # PostgreSQL для локальної розробки
└── .env.example            # зразок змінних середовища
```

У продакшені один процес Node.js обслуговує і REST API (`/api/*`), і зібраний клієнт (`client/dist`).
Під час розробки клієнт запускає Vite dev-server (порт 5173), який передає запити `/api` на сервер (порт 4000).

## Вимоги

| Програма | Версія | Примітка |
|---|---|---|
| [Node.js](https://nodejs.org/) | **20.19+** (рекомендовано 24 LTS) | разом з npm 10+ |
| [Git](https://git-scm.com/) | будь-яка актуальна | |
| [PostgreSQL](https://www.postgresql.org/download/) | **15+** | або [Docker Desktop](https://www.docker.com/products/docker-desktop/) — тоді PostgreSQL запускається в контейнері |
| Обліковий запис [AWS](https://aws.amazon.com/) | — | бакет S3 для аудіофайлів |

Команди нижче працюють у PowerShell, cmd і bash (Windows, Linux, macOS).

## Встановлення

```bash
git clone https://github.com/mbidiuk13/music-library.git
```

```bash
cd music-library
```

```bash
npm install
```

`npm install` у корені встановлює залежності обох частин — `server` і `client` (npm workspaces).

## Налаштування `.env`

Усі налаштування й секрети зберігаються у файлі `.env` у корені репозиторію. Його немає в git —
створіть його з зразка:

```bash
cp .env.example .env
```

(у cmd: `copy .env.example .env`) і заповніть значення. Сервер читає файл вбудованим прапорцем
Node.js `--env-file`, без пакета `dotenv`.

| Змінна | Опис | Приклад / за замовчуванням |
|---|---|---|
| `PORT` | порт REST API | `4000` |
| `NODE_ENV` | режим: `development`, `production`, `test` | `development` |
| `CLIENT_URL` | адреса клієнта: дозволене джерело CORS і база посилань у листах | `http://localhost:5173` |
| `CLIENT_DIST` | (необов'язково) тека зі збіркою клієнта для режиму `production` | `client/dist` |
| `DATABASE_URL` | підключення до робочої БД | `postgres://music:music@localhost:5432/music_library` |
| `TEST_DATABASE_URL` | окрема БД для автоматичних тестів (створюється сама) | `postgres://music:music@localhost:5432/music_library_test` |
| `JWT_SECRET` | ключ підпису JWT — **довгий випадковий рядок** | див. нижче |
| `JWT_EXPIRES_IN` | строк дії токена входу | `24h` |
| `AWS_REGION` | регіон бакета S3 | `eu-north-1` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | ключі IAM-користувача з мінімальними правами | |
| `S3_BUCKET` | назва приватного бакета | |
| `S3_PRESIGN_TTL` | строк дії посилання для відтворення, с | `3600` |
| `MAX_UPLOAD_MB` | максимальний розмір аудіофайлу, МБ | `50` |
| `REC_MIN_HISTORY` | M — мінімум прослуханих треків для персональних рекомендацій | `5` |
| `REC_TOP_N` | N — кількість персональних рекомендацій | `20` |
| `POPULAR_LIMIT` | розмір списку «Популярне» | `100` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_USERNAME` | обліковий запис адміністратора для `npm run seed:admin` | |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | пошта для листів відновлення пароля (необов'язково) | без SMTP посилання друкується в консоль сервера |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | лише для продакшену (`deploy/docker-compose.prod.yml`) | |

Випадковий `JWT_SECRET` можна згенерувати так:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Пароль адміністратора (`ADMIN_PASSWORD`) варто задавати за тими самими правилами, що й для
користувачів: 10–64 символи, латинські літери, цифри та спецсимволи, принаймні одна літера,
одна цифра і один спецсимвол.

**Бакет S3.** Створіть приватний бакет і IAM-користувача з мінімальними правами за інструкцією
[`deploy/s3-bucket-setup.md`](deploy/s3-bucket-setup.md) і впишіть `AWS_REGION`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` у `.env`. Для розробки й продакшену використовуйте різні бакети.

## База даних: міграції та наповнення

### 1. Запустити PostgreSQL

**Варіант А — Docker** (логін/пароль/БД `music`/`music`/`music_library`, як у `.env.example`):

```bash
docker compose -f docker-compose.dev.yml up -d
```

**Варіант Б — PostgreSQL, встановлений напряму.** Створіть порожню БД і вкажіть свої логін і пароль
у `DATABASE_URL` та `TEST_DATABASE_URL`:

```bash
psql -U postgres -c "CREATE DATABASE music_library"
```

### 2. Створити схему і наповнити медіатеку

```bash
npm run migrate
```

```bash
npm run seed
```

```bash
npm run seed:admin
```

| Команда | Що робить |
|---|---|
| `npm run migrate` | виконує `database/schema.sql`: 5 таблиць (`users`, `track`, `playlist`, `playlist_track`, `user_listen_history`), обмеження й індекси — однією транзакцією |
| `npm run seed` | виконує `database/seed.sql`: метадані 50 треків медіатеки |
| `npm run seed:admin` | створює адміністратора з `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_USERNAME`; повторний запуск оновлює його пароль та ім'я |
| `npm run migrate:reset` | **видаляє всі таблиці з даними** і створює схему заново (лише для розробки; у `production` заборонено) |

Повторний `npm run migrate` на наявній схемі завершується помилкою «схема вже існує» — дані при цьому не змінюються.

## Аудіофайли: `import:tracks`

Метадані треків з `seed.sql` посилаються на ключі S3 вигляду `tracks/<файл>.mp3`. Самі mp3-файли
в репозиторій не входять (`server/media/` є в `.gitignore`). Щоб треки можна було відтворювати:

1. Покладіть mp3-файли в `server/media/`. Назва файлу — остання частина ключа: `tracks/lisa_sawadika.mp3` → `server/media/lisa_sawadika.mp3`.
2. Завантажте їх у бакет:

   ```bash
   npm run import:tracks
   ```

Скрипт завантажує лише файли, яких ще немає в бакеті, тож його можна запускати повторно. Ключі, для
яких не знайдено локального файлу, перелічуються в підсумку. Нові треки адміністратор додає
в адмін-панелі (кнопка «Завантажити аудіо»).

## Запуск у режимі розробки

```bash
npm run dev
```

Команда одночасно запускає сервер (http://localhost:4000, перезапускається при змінах коду) і клієнт
(http://localhost:5173, оновлюється без перезавантаження сторінки). Відкрийте **http://localhost:5173**.

Перевірка сервера: http://localhost:4000/api/health → `{"status":"ok"}`.

Для входу в адмін-панель використайте `ADMIN_EMAIL` / `ADMIN_PASSWORD` з `.env`; пункт «Адмін-панель»
з'явиться в меню.

## Тести і перевірка коду

Автоматичні тести сервера (Jest + Supertest) — модульні (векторизація, косинусна подібність, вибір
гілки рекомендацій, правила пароля, сервіс S3) й інтеграційні (реєстрація і вхід, доступ без токена
і без прав адміністратора, плейлисти та відкат транзакцій, пошук, завантаження аудіо, роздача клієнта
і заголовки безпеки).

```bash
npm test
```

- Тести працюють з окремою БД `TEST_DATABASE_URL`: вона створюється автоматично, а схема в ній
  перестворюється при кожному запуску. Ця змінна не може збігатися з `DATABASE_URL`.
  Якщо `TEST_DATABASE_URL` не задано, тести, яким потрібна БД, пропускаються.
- До справжнього AWS S3 і пошти тести не звертаються: ключі фіктивні, звернення підмінено.

Статичний аналіз і форматування:

```bash
npm run lint
```

```bash
npm run format:check
```

## Postman-колекція

[`postman/collections/MusicLibrary.postman_collection.json`](postman/collections/MusicLibrary.postman_collection.json) —
усі запити API, згруповані за модулями (Auth Controller, Media Service, Recommendation Engine,
Playlist Service, Адміністратор), з перевірками кодів відповіді.

1. Postman → **Import** → оберіть файл колекції.
2. Запустіть сервер (`npm run dev`). Адреса API — змінна колекції `{{baseUrl}}` (`http://localhost:4000`).
3. Виконайте **Auth Controller → Реєстрація** (один раз) або **Вхід** — отриманий JWT автоматично
   зберігається у змінну `{{token}}` і підставляється в заголовок `Authorization: Bearer` інших запитів.
4. **Recommendation Engine → Популярне** або **Media Service → Пошук** зберігає `{{trackId}}`,
   **Створити плейлист** — `{{playlistId}}`.
5. Для папки **Адміністратор** впишіть у змінну `{{adminPassword}}` значення `ADMIN_PASSWORD`
   з `.env` і виконайте **Вхід адміністратора** (токен — у `{{adminToken}}`). Для **Завантажити аудіо**
   оберіть mp3-файл у полі `file`.
6. Для **Скидання пароля** скопіюйте `token` з посилання, яке після **Забули пароль** з'явиться
   в консолі сервера (або в листі, якщо налаштовано SMTP), у змінну `{{resetToken}}`.

Усю колекцію можна запустити через **Run collection** (Collection Runner).

## Продакшен-збірка локально

Перевірити, як застосунок працюватиме в продакшені, можна без Docker:

```bash
npm run build
```

```bash
npx cross-env NODE_ENV=production CLIENT_URL=http://localhost:4000 node --env-file=.env server/src/server.js
```

Відкрийте http://localhost:4000 — сервер роздає зібраний клієнт з `client/dist` разом з API.
Сервер надсилає суворий заголовок `Content-Security-Policy` (helmet): скрипти і стилі — лише з власного
домену, шрифт — з Google Fonts, аудіо — лише з бакета `S3_BUCKET` у регіоні `AWS_REGION`.

## Розгортання на сервері

Цільове середовище: Ubuntu 22.04+ (мінімум 2 CPU / 4 GB RAM / 20 GB SSD), домен, DNS-запис якого
(A/AAAA) вказує на IP сервера, відкриті порти 80 і 443.

```
Інтернет ──HTTPS──▶ nginx (хост, :443, сертифікат Let's Encrypt)
                      └──▶ app (Docker, 127.0.0.1:4000): REST API + client/dist ──▶ AWS S3
                            └──▶ postgres (Docker, volume pgdata)
```

| Файл | Призначення |
|---|---|
| [`deploy/Dockerfile`](deploy/Dockerfile) | multi-stage: збирає клієнт, потім образ лише з production-залежностями сервера і `client/dist` |
| [`deploy/docker-compose.prod.yml`](deploy/docker-compose.prod.yml) | сервіси `app` і `postgres` (дані — у volume `pgdata`) |
| [`deploy/nginx.conf`](deploy/nginx.conf) | HTTPS, переадресація з HTTP, reverse proxy на `127.0.0.1:4000`, `client_max_body_size 60m` |
| [`deploy/deploy.sh`](deploy/deploy.sh) | встановлення Docker/nginx/certbot, `git pull`, збірка й запуск контейнерів, ініціалізація БД, HTTPS |
| [`deploy/s3-bucket-setup.md`](deploy/s3-bucket-setup.md), [`deploy/iam-policy.json`](deploy/iam-policy.json) | приватний бакет і IAM-користувач з мінімальними правами |

### Перше розгортання

1. Створіть prod-бакет S3 і IAM-користувача за [`deploy/s3-bucket-setup.md`](deploy/s3-bucket-setup.md).
2. На сервері клонуйте репозиторій і створіть `.env`:

   ```bash
   git clone https://github.com/mbidiuk13/music-library.git && cd music-library && cp .env.example .env
   ```

3. Заповніть `.env` для продакшену:
   - `CLIENT_URL=https://<ваш домен>`;
   - новий `JWT_SECRET` (не той, що для розробки);
   - `POSTGRES_USER`, `POSTGRES_PASSWORD` (довгий, лише латинські літери й цифри), `POSTGRES_DB` —
     `DATABASE_URL` для контейнера складається з них автоматично;
   - ключі й назва **prod**-бакета S3, `AWS_REGION` — регіон саме цього бакета;
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`; за потреби — `SMTP_*`, щоб листи відновлення пароля доходили користувачам.

   `NODE_ENV` і `PORT` задає `docker-compose.prod.yml`, змінювати їх у `.env` не потрібно.
4. (Необов'язково) скопіюйте mp3-файли медіатеки в `server/media/` — скрипт завантажить їх у бакет.
5. Запустіть розгортання:

   ```bash
   sudo DOMAIN=music.example.com LETSENCRYPT_EMAIL=you@example.com ./deploy/deploy.sh
   ```

Скрипт встановлює Docker, nginx і certbot, збирає образ, запускає контейнери, при першому запуску
виконує `migrate`, `seed`, `seed:admin` (і `import:tracks`, якщо в `server/media/` є mp3), отримує
сертифікат Let's Encrypt і вмикає сайт у nginx. Сертифікат поновлюється автоматично (таймер certbot).

### Оновлення

Після нових комітів у `main` достатньо повторити ту саму команду `deploy.sh`: вона виконає `git pull`,
перезбере образ і перезапустить контейнер `app`. Дані БД зберігаються у volume `pgdata`; ініціалізація
БД при наявній схемі пропускається.

### Корисні команди на сервері

Усі — з кореня репозиторію:

```bash
docker compose --env-file .env -f deploy/docker-compose.prod.yml ps
```

```bash
docker compose --env-file .env -f deploy/docker-compose.prod.yml logs -f app
```

Створити або оновити адміністратора після зміни `ADMIN_*` у `.env` (контейнер читає `.env` під час
запуску, тому спершу перезапустіть його):

```bash
docker compose --env-file .env -f deploy/docker-compose.prod.yml up -d app && docker compose --env-file .env -f deploy/docker-compose.prod.yml exec app node server/src/db/seed-admin.js
```

Завантажити в бакет mp3-файли з `server/media/`, додані пізніше:

```bash
docker compose --env-file .env -f deploy/docker-compose.prod.yml run --rm -v "$PWD/server/media:/app/server/media:ro" app node server/scripts/import-tracks.js
```

Резервна копія БД:

```bash
docker compose --env-file .env -f deploy/docker-compose.prod.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql
```

## Команди npm

Запускаються з кореня репозиторію.

| Команда | Опис |
|---|---|
| `npm run dev` | сервер (:4000) і клієнт (:5173) у режимі розробки |
| `npm run build` | збірка клієнта в `client/dist` |
| `npm start` | запуск сервера без `--env-file` (змінні середовища задає оточення, напр. Docker) |
| `npm run migrate` / `npm run migrate:reset` | створити схему БД / перестворити її з видаленням даних |
| `npm run seed` | наповнити медіатеку з `database/seed.sql` |
| `npm run seed:admin` | створити або оновити адміністратора з `.env` |
| `npm run import:tracks` | завантажити mp3 з `server/media/` у S3 |
| `npm test` | автоматичні тести сервера |
| `npm run lint` | ESLint |
| `npm run format` / `npm run format:check` | Prettier: відформатувати / перевірити |

## Типові проблеми

| Симптом | Причина і рішення |
|---|---|
| `.env: not found` під час запуску команд | у корені немає `.env` — скопіюйте `.env.example` у `.env` |
| «Не задано JWT_SECRET у файлі .env» під час запуску сервера | заповніть `JWT_SECRET` у `.env` |
| `ECONNREFUSED 127.0.0.1:5432` або `database "music_library" does not exist` | PostgreSQL не запущено або БД не створено — див. [База даних](#база-даних-міграції-та-наповнення) |
| `схема вже існує` під час `npm run migrate` | схему вже створено; щоб почати з нуля — `npm run migrate:reset` (видаляє дані) |
| `EADDRINUSE :4000` або `:5173` | порт зайнятий іншим процесом — зупиніть його або змініть `PORT` |
| Трек не відтворюється, «Помилка відтворення аудіозапису» | у бакеті немає файлу (`npm run import:tracks`) або неправильні `AWS_*` / `S3_BUCKET` у `.env` |
| Пошук і рекомендації порожні | медіатеку не наповнено — `npm run seed` |
