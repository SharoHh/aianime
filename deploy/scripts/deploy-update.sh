#!/usr/bin/env bash
set -euo pipefail

# Run inside project folder on VPS after git pull.

npm install --registry=https://registry.npmjs.org/
rm -rf .next
npm run build
pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs
pm2 save
pm2 status
npm run smoke
