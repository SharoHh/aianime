#!/usr/bin/env bash
set -euo pipefail

AIANIME_URL="${AIANIME_URL:-http://127.0.0.1:3000}"
CRON_SECRET="${CRON_SECRET:-}"
ACTION="${1:-help}"

call_api(){
  local path="$1"
  if [ -n "$CRON_SECRET" ]; then
    curl -fsS "$AIANIME_URL$path&token=$CRON_SECRET"
  else
    curl -fsS "$AIANIME_URL$path"
  fi
  echo
}

case "$ACTION" in
  sync)
    call_api "/api/cron/sync?enable=1&limit=${JIKAN_SYNC_LIMIT:-25}"
    ;;
  kodik)
    call_api "/api/cron/sync-kodik?enable=1&limit=${KODIK_SYNC_LIMIT:-30}&all=1"
    ;;
  titles)
    call_api "/api/cron/russify-titles?enable=1&limit=${KODIK_TITLE_RU_LIMIT:-80}"
    ;;
  russify)
    call_api "/api/cron/russify?enable=1&limit=${RUSSIFY_CONTENT_LIMIT:-80}&clean=1"
    ;;
  players)
    call_api "/api/cron/players?enable=1&limit=${PLAYERS_SYNC_LIMIT:-30}"
    ;;
  schedule)
    call_api "/api/cron/schedule?enable=1&limit=${JIKAN_SCHEDULE_LIMIT:-25}&pages=${JIKAN_SCHEDULE_PAGES:-1}"
    ;;
  audit)
    call_api "/api/cron/audit-player-integrity?enable=1&limit=${PLAYER_AUDIT_LIMIT:-10}&offset=${PLAYER_AUDIT_OFFSET:-0}&timeout=${PLAYER_AUDIT_TIMEOUT:-45000}"
    ;;
  *)
    echo "Usage: $0 {sync|kodik|titles|russify|players|schedule|audit}"
    exit 1
    ;;
esac
