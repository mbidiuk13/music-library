# Налаштування бакета AWS S3 і IAM-користувача

Аудіофайли MusicLibrary зберігаються в **приватному** бакеті AWS S3. Браузер ніколи не отримує
ключів доступу: сервер видає тимчасове посилання (pre-signed URL) на 60 хвилин (`S3_PRESIGN_TTL=3600`),
а прямий доступ до об'єктів заблоковано.

Для локальної розробки і для продакшену створюються **окремі** бакети (і, бажано, окремі IAM-користувачі).
Нижче `YOUR_BUCKET_NAME` — назва вашого бакета, `eu-north-1` — приклад регіону.

## 1. Створити бакет

AWS Console → **S3** → **Create bucket**:

| Параметр | Значення |
|---|---|
| Bucket type | General purpose |
| Bucket name | `YOUR_BUCKET_NAME` (унікальна в усьому AWS, лише малі літери, цифри, `-`) |
| AWS Region | регіон, ближчий до користувачів, напр. `eu-north-1` |
| Object Ownership | ACLs disabled (Bucket owner enforced) |
| Block Public Access | **Block all public access — увімкнено** (усі 4 пункти) |
| Bucket Versioning | Disable (видалений адміністратором трек не має залишатися в бакеті) |
| Default encryption | SSE-S3 (Amazon S3 managed keys) |

Bucket policy і ACL **не додавати**: публічного доступу немає, читання — лише за підписаним посиланням.

CORS для бакета не потрібен: плеєр відтворює файл через `<audio src="pre-signed URL">`, а це звичайне
завантаження медіа, на яке політика CORS не поширюється.

### Правило життєвого циклу (рекомендовано)

Файли понад 5 МБ сервер завантажує частинами (multipart upload). Якщо завантаження обірвалося,
незавершені частини не видно в списку об'єктів, але за них нараховується плата. Щоб вони видалялися автоматично:

Бакет → **Management** → **Create lifecycle rule**:
- Rule name: `abort-incomplete-uploads`; scope — **Apply to all objects in the bucket**;
- Lifecycle rule actions: лише **Delete expired object delete markers or incomplete multipart uploads**;
- **Delete incomplete multipart uploads** → Number of days: `1`.

## 2. Створити IAM-політику з мінімальними правами

AWS Console → **IAM** → **Policies** → **Create policy** → вкладка **JSON** → вставити вміст
[`iam-policy.json`](iam-policy.json), замінивши `YOUR_BUCKET_NAME` на назву бакета (у двох місцях).
Назва політики, напр. `MusicLibraryAudioAccess`.

| Дозвіл | Ресурс | Навіщо |
|---|---|---|
| `s3:PutObject` | `arn:aws:s3:::YOUR_BUCKET_NAME/*` | завантаження аудіо адміністратором (UC-9) і скриптом імпорту |
| `s3:GetObject` | `…/*` | pre-signed URL для відтворення (підпис дійсний лише за наявності цього права) |
| `s3:DeleteObject` | `…/*` | видалення треку адміністратором; компенсація невдалого завантаження |
| `s3:AbortMultipartUpload` | `…/*` | скасування частково завантаженого великого файлу, якщо завантаження не вдалося |
| `s3:ListBucket` | `arn:aws:s3:::YOUR_BUCKET_NAME` | перевірка наявності об'єктів (без нього S3 на відсутній ключ відповідає 403 замість 404) |

Жодних прав на інші бакети, на зміну налаштувань бакета чи на `s3:*` політика не надає.

## 3. Створити IAM-користувача і ключі доступу

1. **IAM** → **Users** → **Create user**, ім'я напр. `music-library-app`. Доступ до AWS Console **не** надавати.
2. **Permissions options** → **Attach policies directly** → обрати `MusicLibraryAudioAccess`.
3. Відкрити створеного користувача → **Security credentials** → **Create access key** →
   use case **Application running outside AWS** → зберегти *Access key ID* і *Secret access key*
   (секретний ключ показується лише один раз).

## 4. Прописати налаштування в `.env`

```
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=<Access key ID>
AWS_SECRET_ACCESS_KEY=<Secret access key>
S3_BUCKET=YOUR_BUCKET_NAME
S3_PRESIGN_TTL=3600
MAX_UPLOAD_MB=50
```

Файл `.env` є в `.gitignore` — ключі не потрапляють у репозиторій. Якщо ключ випадково опублікували,
його треба одразу деактивувати в IAM (**Security credentials** → **Actions** → **Deactivate**) і створити новий.

## 5. Перевірка

1. Запустити сервер (`npm run dev`) і увійти адміністратором (`POST /api/auth/login`).
2. Завантажити mp3: `POST /api/admin/tracks` (`multipart/form-data`: `file` + поля метаданих) → 201.
   У консолі S3 у бакеті з'являється об'єкт `tracks/<id>.mp3`.
3. `GET /api/tracks/<id>/stream` → відкрити `url` з відповіді в браузері: файл відтворюється.
4. Пряме посилання без підпису `https://YOUR_BUCKET_NAME.s3.eu-north-1.amazonaws.com/tracks/<id>.mp3`
   повертає **403 AccessDenied** — бакет закритий.
5. Через 60 хвилин підписане посилання повертає 403 (`Request has expired`).
