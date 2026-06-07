#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-/var/www/aianime}"
cd "$ROOT_DIR"

stamp="$(date +%F-%H%M%S)"
log(){ printf '%s\n' "$*"; }

has_nonempty_key(){
  local file="$1"
  local key="$2"
  [ -f "$file" ] || return 1
  grep -qE "^${key}=.{8,}" "$file" || return 1
}

has_real_supabase(){
  local file="$1"
  [ -f "$file" ] || return 1
  has_nonempty_key "$file" "NEXT_PUBLIC_SUPABASE_URL" || has_nonempty_key "$file" "SUPABASE_URL" || has_nonempty_key "$file" "SUPABASE_PROJECT_URL" || return 1
  has_nonempty_key "$file" "SUPABASE_SERVICE_ROLE_KEY" || return 1
  grep -Eq "^(ENABLE_SUPABASE_RUNTIME|NEXT_PUBLIC_ENABLE_SUPABASE_RUNTIME)=1" "$file" || return 1
}

read_var(){
  local file="$1"
  local key="$2"
  [ -f "$file" ] || return 0
  grep -E "^${key}=" "$file" 2>/dev/null | tail -n 1 | cut -d= -f2-
}

append_or_replace(){
  local file="$1"
  local key="$2"
  local value="${3:-}"
  [ -n "$value" ] || return 0
  if [ -f "$file" ]; then
    grep -vE "^${key}=" "$file" > "${file}.tmp" || true
    mv "${file}.tmp" "$file"
  fi
  printf '%s=%s\n' "$key" "$value" >> "$file"
}

find_supabase_env(){
  local candidates=(
    ".env.local"
    ".env.production"
    ".env"
  )

  while IFS= read -r file; do
    case "$file" in
      *.example|*.sample|*node_modules*|*.zip) continue ;;
    esac
    candidates+=("$file")
  done < <(find "$ROOT_DIR" /root -maxdepth 6 -type f \( -name ".env*" -o -name "*env*" -o -name "*.bak" -o -name "*.backup" \) 2>/dev/null | sort -u)

  local file
  for file in "${candidates[@]}"; do
    [ -f "$file" ] || continue
    if has_real_supabase "$file"; then
      printf '%s\n' "$file"
      return 0
    fi
  done
  return 1
}

log "[AIanime] Emergency restore started: $ROOT_DIR"
log "[AIanime] No cron/sync/seed will be executed. Only env/build/PM2."

if [ -f .env.production ]; then
  cp .env.production ".env.production.before-v211-${stamp}"
  log "[AIanime] Backup saved: .env.production.before-v211-${stamp}"
fi

source_env="$(find_supabase_env || true)"
if [ -z "$source_env" ]; then
  log "[AIanime][ERROR] Could not find real Supabase env."
  log "[AIanime][ERROR] Need a file with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ENABLE_SUPABASE_RUNTIME=1."
  log "[AIanime] Existing env keys, values hidden:"
  for f in .env*; do
    [ -f "$f" ] || continue
    log "==== $f ===="
    grep -E "SUPABASE|KODIK|ADMIN|CRON|AI_RECOMMEND|GEMINI|OPENAI|ENABLE_SUPABASE" "$f" 2>/dev/null | cut -d= -f1 | sort -u || true
  done
  exit 1
fi

log "[AIanime] Supabase env source: $source_env"

# Сохраняем AI-переменные из текущего .env.production, если они уже были прописаны.
ai_provider="$(read_var .env.production AI_PROVIDER || true)"
ai_model="$(read_var .env.production GEMINI_MODEL || true)"
ai_endpoint="$(read_var .env.production AI_RECOMMEND_ENDPOINT || true)"
ai_secret="$(read_var .env.production AI_RECOMMEND_SECRET || true)"
ai_timeout="$(read_var .env.production AI_RECOMMEND_TIMEOUT_MS || true)"
ai_cache="$(read_var .env.production AI_RECOMMEND_CACHE_TTL_MS || true)"

cp "$source_env" .env.production

append_or_replace .env.production AI_PROVIDER "${ai_provider:-gemini}"
append_or_replace .env.production GEMINI_MODEL "${ai_model:-gemini-2.5-flash-lite}"
append_or_replace .env.production AI_RECOMMEND_ENDPOINT "$ai_endpoint"
append_or_replace .env.production AI_RECOMMEND_SECRET "$ai_secret"
append_or_replace .env.production AI_RECOMMEND_TIMEOUT_MS "${ai_timeout:-8000}"
append_or_replace .env.production AI_RECOMMEND_CACHE_TTL_MS "${ai_cache:-21600000}"
chmod 600 .env.production || true

log "[AIanime] Result .env.production keys, values hidden:"
grep -E "^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|ENABLE_SUPABASE_RUNTIME|NEXT_PUBLIC_ENABLE_SUPABASE_RUNTIME|KODIK_TOKEN|KODIK_API_KEY|ADMIN_SECRET|CRON_SECRET|AI_PROVIDER|GEMINI_MODEL|AI_RECOMMEND_ENDPOINT|AI_RECOMMEND_SECRET|AI_RECOMMEND_TIMEOUT_MS|AI_RECOMMEND_CACHE_TTL_MS)=" .env.production 2>/dev/null | cut -d= -f1 | sort -u || true

log "[AIanime] Installing deps/building/restarting PM2..."
npm install --registry=https://registry.npmjs.org/
rm -rf .next
npm run build
pm2 delete aianime 2>/dev/null || true
pm2 start ecosystem.config.cjs --update-env
pm2 save
sleep 5

log "[AIanime] Health check:"
curl -fsS http://127.0.0.1:3000/api/health 2>/dev/null | python3 -m json.tool || true

log "[AIanime] Done. Check https://aianime.ru/api/health"
