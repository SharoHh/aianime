# AIanime — player voice sidebar redesign

Изменение собрано поверх `Aianime-player-catalog-integrity-audit-v60-2-build-safe-route-timeout-safe`.

Что изменено:
- `components/KodikPlayerClient.js` — плеер теперь расположен слева, выбор озвучек вынесен в правую вертикальную панель.
- `app/globals.css` — добавлен блок `v61: cinema player layout — right-side voice rail`.

Что не трогалось:
- каталог / Supabase / anime_episodes;
- API плеера и Kodik-логика;
- `/api/cron/audit-player-integrity` route-safe фикс;
- структура страницы тайтла, постер, описания, жанры.

Проверка после деплоя:
```bash
cd /var/www/aianime
npm install --registry=https://registry.npmjs.org/
rm -rf .next
npm run build
pm2 restart aianime --update-env
pm2 save
```
