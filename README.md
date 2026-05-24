# AIanime

Next.js проект AIanime. Публичный UI не меняется: premium light anime platform, Manrope typography, готовый layout.

## Локальный запуск

```bash
npm install
npm run dev
```

## Vercel

Архив подготовлен для Vercel:
- `package-lock.json` удалён;
- `.npmrc` использует официальный npm registry;
- `vercel.json` безопасный, cron временно отключён;
- `.env.example` без секретов;
- `.env.local` нельзя коммитить в GitHub.

Переменные добавлять только в Vercel → Project → Settings → Environment Variables.

## Проверка Kodik

Файл проверки находится здесь:

```txt
public/kodik.txt
```

После деплоя он должен открываться по адресу:

```txt
https://your-domain/kodik.txt
```

## Админка

- `/admin/diagnostics` — диагностика Supabase / Jikan / Kodik / players
- `/api/admin/diagnostics` — JSON диагностики
- `/api/cron/sync` — Jikan/MAL sync
- `/api/cron/sync-kodik` — Kodik metadata sync
- `/api/cron/players` — сохранение player embed

## Supabase

SQL-файлы находятся в папке:

```txt
supabase/
```

Основные файлы:
- `schema.sql`
- `user_schema.sql`
- `jikan_migration.sql`
- `kodik_migration.sql`
- `kodik_player_migration.sql`
- `sync_state_repair.sql`
