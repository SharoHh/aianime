#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-/var/www/aianime}"
cd "$ROOT_DIR"

stamp="$(date +%F-%H%M%S)"
log(){ printf '%s\n' "$*"; }

read_last_var(){
  local file="$1" key="$2"
  [ -f "$file" ] || return 0
  grep -E "^${key}=" "$file" 2>/dev/null | tail -n 1 | cut -d= -f2-
}

is_placeholder(){
  local v="${1:-}"
  case "$v" in
    ""|your_*|change_me*|example*|placeholder*|TODO*|todo*) return 0 ;;
  esac
  echo "$v" | grep -qiE 'your_|change_me|example|placeholder|supabase_project_url|supabase_service_role_key|anon_key' && return 0
  return 1
}

has_real_supabase_env(){
  local file="$1"
  [ -f "$file" ] || return 1
  local url service enabled
  url="$(read_last_var "$file" NEXT_PUBLIC_SUPABASE_URL || true)"
  [ -n "$url" ] || url="$(read_last_var "$file" SUPABASE_URL || true)"
  [ -n "$url" ] || url="$(read_last_var "$file" SUPABASE_PROJECT_URL || true)"
  service="$(read_last_var "$file" SUPABASE_SERVICE_ROLE_KEY || true)"
  enabled="$(read_last_var "$file" ENABLE_SUPABASE_RUNTIME || true)"
  [ -n "$enabled" ] || enabled="$(read_last_var "$file" NEXT_PUBLIC_ENABLE_SUPABASE_RUNTIME || true)"

  is_placeholder "$url" && return 1
  is_placeholder "$service" && return 1
  [ "${enabled:-}" = "1" ] || return 1
  return 0
}

append_or_replace(){
  local file="$1" key="$2" value="${3:-}"
  [ -n "$value" ] || return 0
  grep -vE "^${key}=" "$file" > "${file}.tmp" || true
  mv "${file}.tmp" "$file"
  printf '%s=%s\n' "$key" "$value" >> "$file"
}

print_keys(){
  local file="$1"
  [ -f "$file" ] || return 0
  grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_URL|SUPABASE_PROJECT_URL|SUPABASE_SERVICE_ROLE_KEY|ENABLE_SUPABASE_RUNTIME|NEXT_PUBLIC_ENABLE_SUPABASE_RUNTIME|KODIK_TOKEN|KODIK_API_KEY|ADMIN_SECRET|CRON_SECRET|AI_PROVIDER|GEMINI_MODEL|AI_RECOMMEND_ENDPOINT|AI_RECOMMEND_SECRET)=' "$file" 2>/dev/null | cut -d= -f1 | sort -u
}

log "[AIanime rescue] root=$ROOT_DIR"
log "[AIanime rescue] sync/cron/seed are NOT executed"

if [ -f .env.production ]; then
  cp .env.production ".env.production.before-rescue-${stamp}"
  log "[AIanime rescue] backup: .env.production.before-rescue-${stamp}"
fi

# Preserve current AI settings from broken .env.production if present.
current_env=".env.production"
ai_provider="$(read_last_var "$current_env" AI_PROVIDER || true)"
ai_model="$(read_last_var "$current_env" GEMINI_MODEL || true)"
ai_endpoint="$(read_last_var "$current_env" AI_RECOMMEND_ENDPOINT || true)"
ai_secret="$(read_last_var "$current_env" AI_RECOMMEND_SECRET || true)"
ai_timeout="$(read_last_var "$current_env" AI_RECOMMEND_TIMEOUT_MS || true)"
ai_cache="$(read_last_var "$current_env" AI_RECOMMEND_CACHE_TTL_MS || true)"
[ -n "$ai_provider" ] || ai_provider="gemini"
[ -n "$ai_model" ] || ai_model="gemini-2.5-flash-lite"
[ -n "$ai_endpoint" ] || ai_endpoint="http://5.129.224.158:8787/recommend"
[ -n "$ai_timeout" ] || ai_timeout="8000"
[ -n "$ai_cache" ] || ai_cache="21600000"

# Build rescue candidates. Include PM2 dumps because old env can survive there.
workdir="$(mktemp -d)"
cleanup(){ rm -rf "$workdir"; }
trap cleanup EXIT

# Extract env blocks from PM2 dumps to temporary .env files.
for dump in /root/.pm2/dump.pm2 /root/.pm2/dump.pm2.bak /root/.pm2/dump.backup.pm2; do
  [ -f "$dump" ] || continue
  node - "$dump" "$workdir" <<'NODE' || true
const fs = require('fs')
const dump = process.argv[2]
const outDir = process.argv[3]
const keys = [
  'NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_URL','SUPABASE_PROJECT_URL','SUPABASE_SERVICE_ROLE_KEY',
  'ENABLE_SUPABASE_RUNTIME','NEXT_PUBLIC_ENABLE_SUPABASE_RUNTIME','KODIK_TOKEN','KODIK_API_KEY','ADMIN_SECRET','CRON_SECRET',
  'AI_PROVIDER','GEMINI_MODEL','AI_RECOMMEND_ENDPOINT','AI_RECOMMEND_SECRET','AI_RECOMMEND_TIMEOUT_MS','AI_RECOMMEND_CACHE_TTL_MS'
]
try{
  const data = JSON.parse(fs.readFileSync(dump, 'utf8'))
  const apps = Array.isArray(data) ? data : (Array.isArray(data.apps) ? data.apps : [])
  apps.forEach((app, i) => {
    const env = app.pm2_env || app.env || {}
    const lines = []
    for(const key of keys){
      if(env[key]) lines.push(`${key}=${env[key]}`)
    }
    if(lines.length) fs.writeFileSync(`${outDir}/pm2-dump-${i}.env`, lines.join('\n')+'\n')
  })
}catch(e){}
NODE
done

mapfile -t candidates < <(
  {
    find "$ROOT_DIR" -maxdepth 6 -type f \( -name ".env*" -o -name "*env*" -o -name "*.bak" -o -name "*.backup" \) 2>/dev/null
    find /root -maxdepth 6 -type f \( -name ".env*" -o -name "*env*" -o -name "*.bak" -o -name "*.backup" \) 2>/dev/null
    find "$workdir" -type f -name "*.env" 2>/dev/null
  } | grep -vE '\.example$|\.sample$|node_modules|/\.next/|/\.git/|\.zip$' | sort -u | xargs -r ls -t 2>/dev/null
)

source_env=""
for f in "${candidates[@]}"; do
  if has_real_supabase_env "$f"; then
    source_env="$f"
    break
  fi
done

if [ -z "$source_env" ]; then
  log "[AIanime rescue][STOP] Real Supabase env was not found on this server. I will NOT rebuild/start the site with seed-only config."
  log "[AIanime rescue] Existing candidate keys without values:"
  for f in "${candidates[@]}"; do
    [ -f "$f" ] || continue
    keys="$(print_keys "$f" | tr '\n' ' ')"
    [ -n "$keys" ] || continue
    log "==== $f ===="
    log "$keys"
  done
  log "[AIanime rescue] Needed in .env.production: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY + ENABLE_SUPABASE_RUNTIME=1"
  exit 2
fi

log "[AIanime rescue] using Supabase env: $source_env"
cp "$source_env" .env.production

# Ensure runtime flags and AI are present.
append_or_replace .env.production ENABLE_SUPABASE_RUNTIME "1"
append_or_replace .env.production ENABLE_REMOTE_IMAGES "1"
append_or_replace .env.production NEXT_PUBLIC_ENABLE_REMOTE_IMAGES "1"
append_or_replace .env.production AI_PROVIDER "$ai_provider"
append_or_replace .env.production GEMINI_MODEL "$ai_model"
append_or_replace .env.production AI_RECOMMEND_ENDPOINT "$ai_endpoint"
append_or_replace .env.production AI_RECOMMEND_SECRET "$ai_secret"
append_or_replace .env.production AI_RECOMMEND_TIMEOUT_MS "$ai_timeout"
append_or_replace .env.production AI_RECOMMEND_CACHE_TTL_MS "$ai_cache"
chmod 600 .env.production || true

log "[AIanime rescue] restored .env.production keys:"
print_keys .env.production

log "[AIanime rescue] build + PM2 start through ecosystem.config.cjs"
npm install --registry=https://registry.npmjs.org/
rm -rf .next
npm run build
pm2 delete aianime 2>/dev/null || true
pm2 start ecosystem.config.cjs --update-env
pm2 save
sleep 5

log "[AIanime rescue] health:"
curl -fsS http://127.0.0.1:3000/api/health 2>/dev/null | python3 -m json.tool || true
curl -fsS https://aianime.ru/api/health 2>/dev/null | python3 -m json.tool || true
