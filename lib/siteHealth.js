import '@/lib/runtimeEnv'
import { anime as seedAnime } from '@/lib/data'
import { hasSupabase, isSupabaseRuntimeEnabled, supabaseRequest } from '@/lib/supabaseServer'

const MS_IN_DAY = 86400000

function parseCountHeader(header){
  const value = String(header || '')
  const total = value.split('/').pop()
  const number = Number(total)
  return Number.isFinite(number) ? number : null
}

function mondayOfWeek(date = new Date()){
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = base.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  base.setUTCDate(base.getUTCDate() + diff)
  return base
}

async function countTable(table){
  if(!hasSupabase()) return null
  try{
    const res = await supabaseRequest(`${table}?select=*&limit=0`, {
      method:'GET',
      timeout:7000,
      headers:{ Prefer:'count=exact' }
    })
    if(!res.ok) return null
    return parseCountHeader(res.headers.get('content-range'))
  }catch{
    return null
  }
}

async function readAnimeRows(){
  if(!hasSupabase()) return { ok:false, rows:[], error:'supabase-disabled' }

  const primary = 'anime?select=slug,title,title_ru,description,description_ru,status,poster_url,genres,updated_at&limit=1200'
  const fallback = 'anime?select=*&limit=1200'

  for(const query of [primary, fallback]){
    try{
      const res = await supabaseRequest(query, { method:'GET', timeout:10000 })
      if(!res.ok) continue
      const rows = await res.json().catch(() => [])
      if(Array.isArray(rows)) return { ok:true, rows, error:null }
    }catch(error){
      return { ok:false, rows:[], error:error?.message || 'anime-read-failed' }
    }
  }

  return { ok:false, rows:[], error:'anime-table-unavailable' }
}

async function readScheduleRows(){
  if(!hasSupabase()) return { ok:false, rows:[], latestUpdatedAt:null, error:'supabase-disabled' }

  const weekStart = mondayOfWeek(new Date())
  const from = new Date(weekStart.getTime() - 2 * MS_IN_DAY).toISOString()
  const to = new Date(weekStart.getTime() + 9 * MS_IN_DAY).toISOString()
  const query = `anime_schedule?select=id,anime_slug,title,title_ru,airing_at,updated_at&airing_at=gte.${encodeURIComponent(from)}&airing_at=lt.${encodeURIComponent(to)}&order=airing_at.asc&limit=800`

  try{
    const res = await supabaseRequest(query, { method:'GET', timeout:9000 })
    if(!res.ok){
      const text = await res.text().catch(() => '')
      return { ok:false, rows:[], latestUpdatedAt:null, error:`${res.status} ${text.slice(0, 120)}` }
    }
    const rows = await res.json().catch(() => [])
    const safeRows = Array.isArray(rows) ? rows : []
    const latestUpdatedAt = safeRows
      .map(row => row?.updated_at)
      .filter(Boolean)
      .sort()
      .at(-1) || null
    return { ok:true, rows:safeRows, latestUpdatedAt, error:null }
  }catch(error){
    return { ok:false, rows:[], latestUpdatedAt:null, error:error?.message || 'schedule-read-failed' }
  }
}

function hasCyrillic(value){
  return /[А-Яа-яЁё]/.test(String(value || ''))
}

function hasBadSymbols(value){
  return /[●•]{2,}/.test(String(value || ''))
}

function isMissingText(value){
  const text = String(value || '').trim().toLowerCase()
  return !text || text === '—' || text.includes('будет добавлено') || text === 'default'
}

function animeStats(rows){
  const list = Array.isArray(rows) ? rows : []
  return {
    total: list.length,
    titleRu: list.filter(row => String(row?.title_ru || '').trim()).length,
    missingTitleRu: list.filter(row => !String(row?.title_ru || '').trim()).length,
    latinTitleRu: list.filter(row => {
      const value = String(row?.title_ru || '').trim()
      return value && /[A-Za-z]/.test(value) && !hasCyrillic(value)
    }).length,
    badTitleSymbols: list.filter(row => hasBadSymbols(`${row?.title || ''} ${row?.title_ru || ''}`)).length,
    missingDescriptionRu: list.filter(row => isMissingText(row?.description_ru || row?.description)).length,
    ongoing: list.filter(row => String(row?.status || '').toLowerCase() === 'ongoing').length,
    posters: list.filter(row => String(row?.poster_url || '').trim()).length,
  }
}

export async function collectSiteHealth(){
  const startedAt = Date.now()
  const now = new Date().toISOString()
  const supabaseConfigured = hasSupabase()
  const supabaseRuntimeEnabled = isSupabaseRuntimeEnabled()
  const [animeResult, scheduleResult, episodesCount, profilesCount, commentsCount, commentLikesCount, favoritesCount, historyCount, ratingsCount, aiHistoryCount] = await Promise.all([
    readAnimeRows(),
    readScheduleRows(),
    countTable('anime_episodes'),
    countTable('profiles'),
    countTable('anime_comments').then(value => value ?? countTable('comments')),
    countTable('anime_comment_likes'),
    countTable('user_favorites'),
    countTable('user_history'),
    countTable('user_ratings'),
    countTable('user_ai_history'),
  ])

  const anime = animeStats(animeResult.rows)
  const warnings = []

  if(!supabaseConfigured) warnings.push('Supabase runtime выключен или не настроены env')
  if(anime.total > 0 && anime.total <= seedAnime.length) warnings.push('Каталог похож на seed fallback')
  if(anime.total > 0 && anime.missingTitleRu > 0) warnings.push(`Без title_ru: ${anime.missingTitleRu}`)
  if(anime.badTitleSymbols > 0) warnings.push(`Мусорные символы в названиях: ${anime.badTitleSymbols}`)
  if(scheduleResult.ok && scheduleResult.rows.length === 0) warnings.push('Нет расписания на текущую неделю')
  if(!scheduleResult.ok) warnings.push('Расписание не прочиталось из Supabase')

  const databaseOk = Boolean(supabaseConfigured && animeResult.ok)
  const scheduleOk = Boolean(scheduleResult.ok && scheduleResult.rows.length > 0)

  return {
    ok: true,
    status: databaseOk ? (warnings.length ? 'warning' : 'ok') : 'degraded',
    now,
    durationMs: Date.now() - startedAt,
    runtime: {
      nodeEnv: process.env.NODE_ENV || 'unknown',
      uptimeSec: Math.round(process.uptime?.() || 0),
    },
    env: {
      supabaseRuntimeEnabled,
      supabaseConfigured,
      kodikTokenConfigured: Boolean(process.env.KODIK_TOKEN),
      cronSecretConfigured: Boolean(process.env.CRON_SECRET),
      adminSecretConfigured: Boolean(process.env.ADMIN_SECRET),
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://aianime.ru',
    },
    database: {
      ok: databaseOk,
      animeTableOk: animeResult.ok,
      animeError: animeResult.error || null,
      seedCount: seedAnime.length,
      animeCount: anime.total,
      titleRuCount: anime.titleRu,
      missingTitleRu: anime.missingTitleRu,
      latinTitleRu: anime.latinTitleRu,
      badTitleSymbols: anime.badTitleSymbols,
      missingDescriptionRu: anime.missingDescriptionRu,
      ongoingCount: anime.ongoing,
      posterCount: anime.posters,
      episodeCount: episodesCount,
      profilesCount,
      commentsCount,
      commentLikesCount,
      userFavoritesCount: favoritesCount,
      userHistoryCount: historyCount,
      userRatingsCount: ratingsCount,
      userAiHistoryCount: aiHistoryCount,
    },
    userData: {
      favoritesCount,
      historyCount,
      ratingsCount,
      aiHistoryCount,
      profilesCount,
      commentsCount,
      commentLikesCount,
      ok: [favoritesCount, historyCount, ratingsCount].some(value => Number.isFinite(Number(value)))
    },
    schedule: {
      ok: scheduleOk,
      readOk: scheduleResult.ok,
      count: scheduleResult.rows.length,
      latestUpdatedAt: scheduleResult.latestUpdatedAt,
      error: scheduleResult.error || null,
    },
    warnings,
    hint: 'Публичный health-check без секретов. Значения токенов не раскрываются.',
  }
}
