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

log "[AIanime restore] root=$ROOT_DIR"
log "[AIanime restore] cron/sync/seed NOT executed"

# Preserve current AI settings if present
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

if [ -f .env.production ]; then
  cp .env.production ".env.production.before-restore-${stamp}"
  log "[AIanime restore] backup: .env.production.before-restore-${stamp}"
fi

# Build candidate list: latest backups first, skip examples/samples
mapfile -t candidates < <(
  {
    find "$ROOT_DIR" -maxdepth 3 -type f \( -name ".env*" -o -name "*env*" -o -name "*.bak" -o -name "*.backup" \) 2>/dev/null
    find /root -maxdepth 5 -type f \( -name ".env*" -o -name "*env*" -o -name "*.bak" -o -name "*.backup" \) 2>/dev/null
  } | grep -vE '\.example$|\.sample$|node_modules|/\.next/|/\.git/|\.zip$' | sort -u | xargs -r ls -t 2>/dev/null
)

source_env=""
for f in "${candidates[@]}"; do
  # Current broken file with only AI should fail has_real_supabase_env automatically.
  if has_real_supabase_env "$f"; then
    source_env="$f"
    break
  fi
done

if [ -z "$source_env" ]; then
  log "[AIanime restore][ERROR] Real Supabase env not found. Values hidden, available keys:"
  for f in "${candidates[@]}"; do
    [ -f "$f" ] || continue
    log "==== $f ===="
    grep -E '^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_URL|SUPABASE_PROJECT_URL|SUPABASE_SERVICE_ROLE_KEY|ENABLE_SUPABASE_RUNTIME|NEXT_PUBLIC_ENABLE_SUPABASE_RUNTIME|KODIK_TOKEN|ADMIN_SECRET|CRON_SECRET|AI_RECOMMEND_ENDPOINT|AI_RECOMMEND_SECRET)=' "$f" 2>/dev/null | cut -d= -f1 | sort -u || true
  done
  log "[AIanime restore][ERROR] Need an env backup containing real NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + ENABLE_SUPABASE_RUNTIME=1."
  exit 2
fi

log "[AIanime restore] using Supabase env: $source_env"
cp "$source_env" .env.production

append_or_replace .env.production AI_PROVIDER "$ai_provider"
append_or_replace .env.production GEMINI_MODEL "$ai_model"
append_or_replace .env.production AI_RECOMMEND_ENDPOINT "$ai_endpoint"
append_or_replace .env.production AI_RECOMMEND_SECRET "$ai_secret"
append_or_replace .env.production AI_RECOMMEND_TIMEOUT_MS "$ai_timeout"
append_or_replace .env.production AI_RECOMMEND_CACHE_TTL_MS "$ai_cache"
chmod 600 .env.production || true

log "[AIanime restore] result keys:"
grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_URL|SUPABASE_PROJECT_URL|SUPABASE_SERVICE_ROLE_KEY|ENABLE_SUPABASE_RUNTIME|NEXT_PUBLIC_ENABLE_SUPABASE_RUNTIME|KODIK_TOKEN|ADMIN_SECRET|CRON_SECRET|AI_PROVIDER|GEMINI_MODEL|AI_RECOMMEND_ENDPOINT|AI_RECOMMEND_SECRET)=' .env.production | cut -d= -f1 | sort -u

log "[AIanime restore] build + PM2 restart"
npm install --registry=https://registry.npmjs.org/
rm -rf .next
npm run build
pm2 delete aianime 2>/dev/null || true

# Load env to PM2 runtime explicitly. Values are not printed.
set -a
. ./.env.production
set +a
pm2 start npm --name aianime -- start
pm2 save
sleep 5

log "[AIanime restore] local health:"
curl -fsS http://127.0.0.1:3000/api/health 2>/dev/null | python3 -m json.tool || true

log "[AIanime restore] public health:"
curl -fsS https://aianime.ru/api/health 2>/dev/null | python3 -m json.tool || true
