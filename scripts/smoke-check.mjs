#!/usr/bin/env node

const SITE_URL = String(process.env.SITE_URL || process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '')
const MIN_CATALOG = Number(process.env.AIANIME_MIN_PRODUCTION_CATALOG_SIZE || 500)
const TEST_SLUG = process.env.AIANIME_SMOKE_TEST_SLUG || ''
const failures = []
const warnings = []

async function readJson(path){
  const url = `${SITE_URL}${path}`
  const res = await fetch(url, { headers:{ 'accept':'application/json' } })
  const text = await res.text().catch(() => '')
  let data = null
  try{ data = text ? JSON.parse(text) : null }catch{}
  return { url, status:res.status, ok:res.ok, data, text }
}

async function checkHttp(path, { allowStatuses = [200] } = {}){
  const url = `${SITE_URL}${path}`
  const res = await fetch(url, { redirect:'manual' })
  if(!allowStatuses.includes(res.status)){
    failures.push(`${path}: HTTP ${res.status}, expected ${allowStatuses.join('/')}`)
  }
  return res
}

function fail(message){ failures.push(message) }
function warn(message){ warnings.push(message) }

console.log(`AIanime smoke-check: ${SITE_URL}`)

const health = await readJson('/api/health')
if(!health.data){
  fail(`/api/health: invalid JSON, HTTP ${health.status}`)
}else{
  const db = health.data.database || {}
  const env = health.data.env || {}
  console.log(`health.status=${health.data.status}; animeCount=${db.animeCount}; guard=${db.productionCatalogGuardEnabled}; degraded=${db.catalogDegraded}`)

  if(health.status >= 500 || health.data.status === 'degraded') fail(`/api/health degraded: ${JSON.stringify(health.data.warnings || [])}`)
  if(!env.supabaseConfigured) fail('Supabase is not configured/enabled at runtime')
  if(Number(db.animeCount || 0) < MIN_CATALOG) fail(`animeCount ${db.animeCount} ниже минимума ${MIN_CATALOG}`)
  if(db.catalogDegraded) fail('catalogDegraded=true — прод рискует уйти в seed/пустой каталог')
  if(Number(db.animeCount || 0) > 0 && Number(db.animeCount || 0) <= Number(db.seedCount || 40)) fail(`Каталог похож на seed fallback: animeCount=${db.animeCount}, seedCount=${db.seedCount}`)
  if(!env.kodikTokenConfigured) warn('KODIK_TOKEN не настроен: плеер/cron Kodik могут не работать')
  if(!env.cronSecretConfigured) warn('CRON_SECRET не настроен: /api/cron будет закрыт')
  if(!env.adminSecretConfigured && !env.adminExternalAuthTrusted) warn('ADMIN_SECRET не настроен и Nginx auth не помечен доверенным')
}

await checkHttp('/')
await checkHttp('/catalog')
await checkHttp('/schedule')

if(TEST_SLUG){
  await checkHttp(`/anime/${encodeURIComponent(TEST_SLUG)}`, { allowStatuses:[200, 404] })
  const player = await readJson(`/api/player/options?slug=${encodeURIComponent(TEST_SLUG)}`)
  if(player.status >= 500) fail(`/api/player/options failed for ${TEST_SLUG}: HTTP ${player.status}`)
}

for(const message of warnings) console.warn(`WARN: ${message}`)
if(failures.length){
  console.error('\nSmoke-check FAILED:')
  for(const message of failures) console.error(`- ${message}`)
  process.exit(1)
}

console.log('Smoke-check OK')
