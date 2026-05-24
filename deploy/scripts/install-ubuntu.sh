#!/usr/bin/env bash
set -euo pipefail

# Ubuntu 22.04/24.04 base setup for AIanime.
# Run as root or with sudo: bash deploy/scripts/install-ubuntu.sh

apt update
apt install -y curl git nginx ufw ca-certificates build-essential

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi

npm install -g pm2

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

systemctl enable nginx
systemctl restart nginx

echo "Server base is ready. Next: clone repo, create .env.production, npm install, npm run build, pm2 start ecosystem.config.cjs"
