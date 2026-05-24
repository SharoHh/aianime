import { hasKodik } from '@/lib/kodik'
import { hasSupabase, isSupabaseRuntimeEnabled, supabaseRequest } from '@/lib/supabaseServer'

const ANIME_REQUIRED_COLUMNS = [
  'id','slug','title','original_title','description','poster_url','banner_url','rating','episodes','status','year','genres',
  'mal_id','title_ru','title_orig_kodik','kodik_id','kodik_link','translation_title','translation_type','quality','kodik_screenshots','kodik_updated_at'
]

const EPISODE_REQUIRED_COLUMNS = [
  'id','anime_slug','episode_number','title','provider','voice','embed_url','hls_url','status','source','raw','created_at','updated_at'
]

function boolEnv(name){
  return process.env[name] === '1' || process.env[name] === 'true'
}

function existsEnv(name){
  return Boolean(process.env[name])
}

function parseCountFromRange(range){
  if(!range) return null
  const match = String(range).match(/\/(\d+|\*)$/)
  if(!match || match[1] === '*') return null
  return Number(match[1])
}

async function fetchWithTimeout(url, options = {}){
  const controller = new AbortController()
  const timeout = Number(options.timeout || 6000)
  const timer = setTimeout(() => controller.abort(), timeout)
  try{
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Aianime-admin-diagnostics/1.0',
        ...(options.headers || {})
      }
    })
    let body = null
    try { body = await res.json() } catch { body = await res.text().catch(() => null) }
    return { ok: res.ok, status: res.status, body }
  }finally{
    clearTimeout(timer)
  }
}

async function countRows(table, filter = ''){
  if(!hasSupabase()) return { ok:false, count:0, skipped:true, reason:'Supabase env is not configured' }

  const query = `${table}?select=id${filter ? `&${filter}` : ''}`
  try{
    const res = await supabaseRequest(query, {
      method:'GET',
      headers:{ Prefer:'count=exact', Range:'0-0' },
      timeout: 9000
    })
    const text = !res.ok ? await res.text().catch(() => '') : ''
    if(!res.ok) return { ok:false, count:0, status:res.status, error:text }

    const fromHeader = parseCountFromRange(res.headers.get('content-range'))
    if(Number.isFinite(fromHeader)) return { ok:true, count:fromHeader }

    const rows = await res.json().catch(() => [])
    return { ok:true, count:Array.isArray(rows) ? rows.length : 0, approximate:true }
  }catch(error){
    return { ok:false, count:0, error:error?.message || String(error) }
  }
}

async function checkColumn(table, column){
  try{
    const res = await supabaseRequest(`${table}?select=${encodeURIComponent(column)}&limit=1`, { method:'GET', timeout: 7000 })
    if(res.ok) return { column, ok:true }
    const text = await res.text().catch(() => '')
    return { column, ok:false, status:res.status, error:text }
  }catch(error){
    return { column, ok:false, error:error?.message || String(error) }
  }
}

async function checkTable(table, requiredColumns){
  if(!hasSupabase()) return { ok:false, exists:false, missingColumns:requiredColumns, reason:'Supabase env is not configured' }

  try{
    const base = await supabaseRequest(`${table}?select=id&limit=1`, { method:'GET', timeout: 8000 })
    if(!base.ok){
      const text = await base.text().catch(() => '')
      return { ok:false, exists:false, missingColumns:requiredColumns, status:base.status, error:text }
    }

    const checks = await Promise.all(requiredColumns.map(col => checkColumn(table, col)))
    const missingColumns = checks.filter(x => !x.ok).map(x => x.column)
    return {
      ok: missingColumns.length === 0,
      exists:true,
      checkedColumns:requiredColumns.length,
      missingColumns,
      columnsOk: requiredColumns.length - missingColumns.length
    }
  }catch(error){
    return { ok:false, exists:false, missingColumns:requiredColumns, error:error?.message || String(error) }
  }
}

async function readSyncStates(){
  if(!hasSupabase()) return { ok:false, rows:[], reason:'Supabase env is not configured' }
  try{
    const res = await supabaseRequest('sync_state?select=*&order=updated_at.desc&limit=20', { method:'GET', timeout:8000 })
    if(!res.ok){
      const text = await res.text().catch(() => '')
      return { ok:false, rows:[], status:res.status, error:text }
    }
    const rows = await res.json().catch(() => [])
    return { ok:true, rows:Array.isArray(rows) ? rows : [] }
  }catch(error){
    return { ok:false, rows:[], error:error?.message || String(error) }
  }
}

async function checkJikan(deep){
  if(!deep) return { checked:false, ok:null, label:'Не проверялся', hint:'Нажми “Глубокая диагностика”, чтобы проверить внешний Jikan/MAL.' }
  try{
    const res = await fetchWithTimeout('https://api.jikan.moe/v4/anime/1', { timeout: 6500 })
    return {
      checked:true,
      ok:res.ok,
      status:res.status,
      label:res.ok ? 'Доступен' : 'Ошибка ответа',
      hint:res.ok ? 'Jikan отвечает. Можно запускать Jikan sync.' : 'Jikan ответил ошибкой. Проверь VPN/доступ/лимиты.'
    }
  }catch(error){
    return { checked:true, ok:false, label:'Недоступен', error:error?.message || String(error), hint:'Jikan не ответил за timeout. На локалке без VPN sync может падать.' }
  }
}

async function checkKodik(deep){
  if(!hasKodik()) return { checked:deep, ok:false, label:'Нет токена', hint:'Добавь KODIK_TOKEN в .env.local / Vercel env.' }
  if(!deep) return { checked:false, ok:null, label:'Токен есть, API не проверялся', hint:'Нажми “Глубокая диагностика”, чтобы проверить Kodik API.' }

  try{
    const search = new URLSearchParams()
    search.set('token', process.env.KODIK_TOKEN || process.env.NEXT_PUBLIC_KODIK_TOKEN || '')
    search.set('limit', '1')
    search.set('types', 'anime,anime-serial')
    search.set('with_material_data', 'false')
    search.set('title', 'Naruto')
    const res = await fetchWithTimeout(`https://kodikapi.com/search?${search.toString()}`, { timeout: 7500 })
    const results = Array.isArray(res.body?.results) ? res.body.results.length : 0
    return {
      checked:true,
      ok:res.ok,
      status:res.status,
      results,
      label:res.ok ? 'Доступен' : 'Ошибка ответа',
      hint:res.ok ? `Kodik отвечает. Тестовых результатов: ${results}.` : 'Kodik ответил ошибкой. Проверь токен или доступ.'
    }
  }catch(error){
    return { checked:true, ok:false, label:'Недоступен', error:error?.message || String(error), hint:'Kodik не ответил за timeout. Проверь токен/доступ.' }
  }
}

function makeServiceStatuses({ env, supabase, jikan, kodik, counts }){
  return [
    { id:'runtime', title:'Next.js runtime', ok:true, status:'Работает', hint:'Админская API-ручка отвечает.' },
    { id:'supabase-env', title:'Supabase env', ok:env.supabase.configured, status:env.supabase.configured ? 'Настроен' : 'Не настроен', hint:env.supabase.configured ? 'Service role и URL видны серверу.' : 'Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.' },
    { id:'supabase-db', title:'Supabase database', ok:supabase.connectionOk, status:supabase.connectionOk ? 'Подключена' : 'Нет подключения', hint:supabase.connectionHint },
    { id:'schema', title:'SQL миграции', ok:supabase.schemaOk, status:supabase.schemaOk ? 'OK' : 'Нужно проверить', hint:supabase.schemaHint },
    { id:'jikan', title:'Jikan / MAL', ok:jikan.ok, status:jikan.label, hint:jikan.hint },
    { id:'kodik-token', title:'Kodik token', ok:env.kodik.hasToken, status:env.kodik.hasToken ? 'Есть' : 'Нет', hint:env.kodik.hasToken ? 'KODIK_TOKEN виден серверу.' : 'Без KODIK_TOKEN metadata/player sync не заработает.' },
    { id:'kodik-api', title:'Kodik API', ok:kodik.ok, status:kodik.label, hint:kodik.hint },
    { id:'players', title:'Плееры', ok:Number(counts.players || 0) > 0, status:Number(counts.players || 0) > 0 ? `${counts.players} embed` : 'Нет embed', hint:'Должны появиться после /api/cron/players?enable=1.' }
  ]
}

export async function GET(req){
  const startedAt = new Date().toISOString()
  const deep = req.nextUrl.searchParams.get('deep') === '1'

  const env = {
    mode: process.env.NODE_ENV || 'unknown',
    supabase:{
      runtimeEnabled:isSupabaseRuntimeEnabled(),
      url:existsEnv('NEXT_PUBLIC_SUPABASE_URL'),
      anon:existsEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      serviceRole:existsEnv('SUPABASE_SERVICE_ROLE_KEY'),
      configured:hasSupabase(),
    },
    jikan:{
      enabled: boolEnv('ENABLE_JIKAN_SYNC'),
      pagesPerRun: process.env.AUTO_JIKAN_PAGES_PER_RUN || null,
      maxPage: process.env.AUTO_JIKAN_MAX_PAGE || null,
    },
    kodik:{
      hasToken:hasKodik(),
      syncEnabled:boolEnv('ENABLE_KODIK_SYNC'),
      playerSyncEnabled:boolEnv('ENABLE_KODIK_PLAYER_SYNC'),
      playerRuntimeEnabled:boolEnv('ENABLE_KODIK_PLAYER_RUNTIME'),
    },
    images:{
      remoteEnabled: boolEnv('ENABLE_REMOTE_IMAGES') || boolEnv('NEXT_PUBLIC_ENABLE_REMOTE_IMAGES')
    },
    cron:{
      hasSecret: existsEnv('CRON_SECRET')
    }
  }

  const [animeTable, episodesTable, syncState, totalAnime, withMal, withKodik, withRu, episodes, players, jikan, kodik] = await Promise.all([
    checkTable('anime', ANIME_REQUIRED_COLUMNS),
    checkTable('anime_episodes', EPISODE_REQUIRED_COLUMNS),
    readSyncStates(),
    countRows('anime'),
    countRows('anime', 'mal_id=not.is.null'),
    countRows('anime', 'kodik_id=not.is.null'),
    countRows('anime', 'title_ru=not.is.null'),
    countRows('anime_episodes'),
    countRows('anime_episodes', 'embed_url=not.is.null'),
    checkJikan(deep),
    checkKodik(deep)
  ])

  const counts = {
    anime: totalAnime.count || 0,
    withMal: withMal.count || 0,
    withKodik: withKodik.count || 0,
    withRu: withRu.count || 0,
    episodes: episodes.count || 0,
    players: players.count || 0,
  }

  const connectionOk = Boolean(env.supabase.configured && (totalAnime.ok || animeTable.exists))
  const schemaOk = Boolean(animeTable.ok && episodesTable.ok && syncState.ok)
  const supabase = {
    configured: env.supabase.configured,
    connectionOk,
    connectionHint: env.supabase.configured ? (connectionOk ? 'REST API Supabase отвечает.' : 'Env есть, но REST API не отвечает или таблицы не созданы.') : 'Supabase env не настроен.',
    schemaOk,
    schemaHint: schemaOk ? 'Таблицы anime, anime_episodes и sync_state выглядят готовыми.' : 'Есть отсутствующие таблицы/колонки. Выполни SQL миграции из папки supabase.',
    tables:{ anime:animeTable, anime_episodes:episodesTable, sync_state:syncState }
  }

  const services = makeServiceStatuses({ env, supabase, jikan, kodik, counts })

  const recommendations = []
  if(!env.supabase.configured) recommendations.push('Добавь NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.local / Vercel env.')
  if(!animeTable.exists) recommendations.push('Выполни supabase/schema.sql и supabase/jikan_migration.sql — таблица anime не найдена.')
  if(animeTable.missingColumns?.length) recommendations.push(`В таблице anime не хватает колонок: ${animeTable.missingColumns.slice(0,8).join(', ')}${animeTable.missingColumns.length > 8 ? '…' : ''}`)
  if(episodesTable.missingColumns?.length) recommendations.push(`В таблице anime_episodes не хватает колонок: ${episodesTable.missingColumns.slice(0,8).join(', ')}${episodesTable.missingColumns.length > 8 ? '…' : ''}`)
  if(counts.anime === 0 && env.supabase.configured) recommendations.push('Каталог пустой: запусти Jikan sync или seed sync.')
  if(!env.kodik.hasToken) recommendations.push('Добавь KODIK_TOKEN, иначе Kodik metadata и плееры не подтянутся.')
  if(counts.withKodik === 0 && env.kodik.hasToken) recommendations.push('Kodik metadata ещё не заполнена: запусти /api/cron/sync-kodik?enable=1&limit=20&all=1.')
  if(counts.players === 0 && counts.withKodik > 0) recommendations.push('Плееры ещё не сохранены: запусти /api/cron/players?enable=1&limit=20.')
  if(deep && jikan.ok === false) recommendations.push('Jikan/MAL не отвечает с текущей сети. Для автоматического парсинга используй Vercel/server или VPN.')

  return Response.json({
    ok:true,
    deep,
    env,
    services,
    counts,
    supabase,
    external:{ jikan, kodik },
    syncState: syncState.rows || [],
    recommendations,
    startedAt,
    finishedAt:new Date().toISOString()
  })
}
