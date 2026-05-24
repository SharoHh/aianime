# AIanime — VPS deploy guide

Проект подготовлен для VPS: Ubuntu + Node.js + PM2 + Nginx + Certbot.
Публичный дизайн сайта не менялся.

## 1. Рекомендуемый сервер

Минимум для старта:

- Ubuntu 22.04 или 24.04
- 2 vCPU
- 4 GB RAM
- 40–50 GB NVMe/SSD
- 1 публичный IPv4

Не бери 1 GB RAM: `next build` и парсинг могут падать по памяти.

## 2. Первичная настройка сервера

Зайди на сервер по SSH:

```bash
ssh root@SERVER_IP
```

Обнови сервер и поставь базовые пакеты:

```bash
apt update
apt install -y curl git nginx ufw ca-certificates build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

## 3. Загрузка проекта

```bash
cd /var/www
git clone https://github.com/SharoHh/aianime.git
cd aianime
```

Если заливаешь архивом, распакуй проект в:

```bash
/var/www/aianime
```

## 4. Environment variables

Создай production env:

```bash
cp .env.production.example .env.production
nano .env.production
```

Заполни реальные значения:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_SECRET=...
CRON_SECRET=...
OPENAI_API_KEY=...
KODIK_TOKEN=...
```

Важно: реальные ключи не коммитить в GitHub.

## 5. Build и запуск через PM2

```bash
npm install --registry=https://registry.npmjs.org/
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

PM2 должен показать процесс `aianime` online.

Проверка локально на сервере:

```bash
curl http://127.0.0.1:3000/api/health
```

## 6. Nginx

Скопируй конфиг:

```bash
cp deploy/nginx/aianime.ru.conf /etc/nginx/sites-available/aianime.ru
ln -s /etc/nginx/sites-available/aianime.ru /etc/nginx/sites-enabled/aianime.ru
nginx -t
systemctl reload nginx
```

Пока без SSL сайт должен открываться по IP/домену на 80 порту.

## 7. Домен

У регистратора/в DNS:

```txt
aianime.ru      A      SERVER_IP
www             CNAME  aianime.ru
```

Подожди обновления DNS.

## 8. SSL через Certbot

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d aianime.ru -d www.aianime.ru
```

Проверка:

```bash
systemctl status certbot.timer
```

## 9. Cron парсинга

Скопируй cron template:

```bash
cp deploy/cron/aianime-cron.example /etc/cron.d/aianime
nano /etc/cron.d/aianime
```

Замени:

```txt
CRON_SECRET=YOUR_CRON_SECRET
```

на тот же секрет, что в `.env.production`.

Перезапусти cron:

```bash
systemctl restart cron
```

Проверка логов:

```bash
tail -f /var/log/aianime-cron.log
```

## 10. Админка

Открывать так:

```txt
https://aianime.ru/admin/diagnostics?admin_secret=ADMIN_SECRET
```

Cron вручную:

```txt
https://aianime.ru/api/cron/sync?enable=1&limit=25&token=CRON_SECRET
https://aianime.ru/api/cron/sync-kodik?enable=1&limit=30&all=1&token=CRON_SECRET
https://aianime.ru/api/cron/players?enable=1&limit=30&token=CRON_SECRET
```

## 11. Обновление проекта

```bash
cd /var/www/aianime
git pull
bash deploy/scripts/deploy-update.sh
```

## 12. Полезные команды

```bash
pm2 status
pm2 logs aianime
pm2 restart aianime
nginx -t
systemctl reload nginx
curl http://127.0.0.1:3000/api/health
```
