import { verifyCronAccess, cronAuthError } from '@/lib/cronAuth'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const DEFAULT_TIMEOUT_MS = 25000
const MAX_TIMEOUT_MS = 60000

function json(payload, status = 200){
  return Response.json(payload, {
    status,
    headers:{ 'Cache-Control':'no-store, max-age=0' }
  })
}

async function readJson(res){
  const text = await res.text().catch(() => '')
  if(!text) return null
  try{ return JSON.parse(text) }catch{ return { __raw:text.slice(0, 800) } }
}

function number(value){
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function clamp(value, min, max){
  const n = number(value)
  if(!n) return min
  return Math.min(Math.max(Math.floor(n), min), max)
}

function normalize(value){
  return String(value || '').toLowerCase().replace(/ё/g, 'е')
}

function countFromText(text){
  const normalized = normalize(text).replace(/[^a-zа-я0-9]+/gi, ' ').replace(/\s+/g, ' ').trim()
  const patterns = [
    /(?:в сезоне указано|указано|сезоне|сезон)\s*(\d{1,4})\s*(?:сер|серии|серий|эп|эпизод)/i,
    /(\d{1,4})\s*(?:серия|серии|серий|эпизод|эпизода|эпизодов)/i,
    /(?:ova|она|special|спешл)\s*(\d{1,4})/i,
  ]
  for(const pattern of patterns){
    const match = normalized.match(pattern)
    const n = number(match?.[1])
    if(n > 0 && n < 2000) return Math.floor(n)
  }
  return 0
}

function yearFromText(text){
  const normalized = String(text || '')
  const years = Array.from(normalized.matchAll(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/g)).map(match => number(match[1]))
  return years.find(y => y >= 1960 && y <= 2035) || 0
}

function hasSeasonMarker(text){
  const value = normalize(text)
  return /(?:season|сезон|tv|тв)[\s._:-]*\d|(?:part|часть|cour)[\s._:-]*\d|\b\d+(?:st|nd|rd|th)[\s._:-]+season\b|\bs\d+\b|\bp\d+\b|\bthe[\s._:-]*final\b|\bfinal\s*season\b|финал|финальный|заключительный/.test(value)
}

function hasSpecialMarker(text){
  const value = normalize(text)
  return /\bova\b|\bona\b|special|спешл|спец|movie|film|фильм|кино/.test(value)
}

function isLongFranchise(anime = {}){
  const text = normalize([anime.slug, anime.title, anime.title_ru, anime.original_title, anime.description_ru].filter(Boolean).join(' '))
  const expected = number(anime.episodes)
  return expected > 64 || /pokemon|покемон|pocket monster|naruto|one piece|bleach|conan|detective conan|dragon ball|yu-gi-oh|yugioh|digimon|precure/.test(text)
}

function strictTolerance(anime = {}){
  const text = [anime.slug, anime.title, anime.title_ru, anime.original_title, anime.description_ru].filter(Boolean).join(' ')
  if(hasSpecialMarker(text)) return 1
  if(hasSeasonMarker(text)) return 1
  return 6
}

function isContinuousOneToN(episodes, expected){
  if(!expected || !Array.isArray(episodes) || episodes.length !== expected) return false
  if(episodes[0] !== 1 || episodes[episodes.length - 1] !== expected) return false
  return episodes.every((episode, index) => episode === index + 1)
}

function millisecondsLeft(deadlineMs, reserveMs = 1200){
  return Math.max(750, deadlineMs - Date.now() - reserveMs)
}

function deadlineReached(deadlineMs, reserveMs = 1800){
  return Date.now() >= deadlineMs - reserveMs
}

function shortError(error){
  return error?.message || String(error || 'Unknown error')
}

function analyzeRowsForAnime(anime, rows = [], extra = {}){
  const expected = number(anime.episodes)
  const longFranchise = isLongFranchise(anime)
  const tolerance = strictTolerance(anime)
  const titleText = [anime.slug, anime.title, anime.title_ru, anime.original_title, anime.description_ru].filter(Boolean).join(' ')
  const parsedEpisodes = countFromText(titleText)
  const parsedYear = yearFromText(titleText)
  const metadataIssues = []

  if(parsedEpisodes && expected && Math.abs(parsedEpisodes - expected) > Math.max(2, Math.ceil(expected * 0.2))){
    metadataIssues.push({ type:'episode-metadata-mismatch', expectedFromDb:expected, parsedFromText:parsedEpisodes })
  }

  if(parsedYear && anime.year && Math.abs(number(anime.year) - parsedYear) > 1){
    metadataIssues.push({ type:'year-metadata-mismatch', yearFromDb:number(anime.year), parsedFromText:parsedYear })
  }

  if(expected > 64 && (hasSeasonMarker(titleText) || hasSpecialMarker(titleText))){
    metadataIssues.push({ type:'long-count-on-season-or-special-title', expectedFromDb:expected })
  }

  const byVoice = new Map()
  for(const row of rows){
    const raw = row.raw || {}
    const voice = row.voice || raw.translation_title || 'Kodik'
    const key = `${row.provider || 'kodik'}:${voice}`
    if(!byVoice.has(key)) byVoice.set(key, [])
    byVoice.get(key).push(row)
  }

  const voiceReports = []
  let hasFullVoice = false

  for(const [key, group] of byVoice.entries()){
    const voice = key.split(':').slice(1).join(':') || 'Kodik'
    const episodes = Array.from(new Set(group.map(row => number(row.episode_number)).filter(Boolean))).sort((a,b) => a-b)
    const min = episodes.length ? episodes[0] : null
    const max = episodes.length ? episodes[episodes.length - 1] : null
    const rawList = group.map(row => row.raw || {})
    const declaredMax = Math.max(...rawList.map(raw => number(raw.episodes_count || raw.last_episode)), 0)
    const seasonNumbers = Array.from(new Set(rawList.map(raw => number(raw.season_number)).filter(Boolean))).sort((a,b) => a-b)
    const matchScores = rawList.map(raw => number(raw.match_score)).filter(Boolean)
    const maxScore = matchScores.length ? Math.max(...matchScores) : 0
    const minScore = matchScores.length ? Math.min(...matchScores) : 0
    const reliableTrue = rawList.filter(raw => raw.reliable_id === true).length
    const reliableFalse = rawList.filter(raw => raw.reliable_id === false).length
    const sources = Array.from(new Set(group.map(row => row.source || row.raw?.source).filter(Boolean)))
    const urls = new Set(group.map(row => String(row.embed_url || '').trim()).filter(Boolean))
    const nativeEpisodeLinks = group.some(row => row.source === 'kodik-api-episode' || row.source === 'kodik-api-season-episode') && episodes.length > 1 && urls.size > 1
    const continuous = episodes.length > 1 ? episodes.every((episode, index) => index === 0 || episode === episodes[index - 1] + 1) : true
    const full = expected > 1 && isContinuousOneToN(episodes, expected)
    if(full) hasFullVoice = true

    const issues = []
    if(expected && max && max > expected) issues.push({ type:'max-episode-over-db', max, expected })
    if(expected && declaredMax && expected <= 64 && declaredMax > expected + tolerance) issues.push({ type:'declared-count-over-db', declaredMax, expected })
    if(expected && full === false && episodes.length && episodes.length < expected) issues.push({ type:'incomplete-voice', count:episodes.length, expected })
    if(episodes.length > 1 && min !== 1) issues.push({ type:'does-not-start-from-1', min })
    if(!continuous) issues.push({ type:'episode-gaps', episodes:episodes.slice(0, 40) })
    if(seasonNumbers.length > 1) issues.push({ type:'mixed-season-numbers', seasonNumbers })
    if(longFranchise && reliableFalse > 0) issues.push({ type:'long-franchise-unreliable-id', reliableFalse, reliableTrue })
    if(longFranchise && maxScore && maxScore < 160) issues.push({ type:'long-franchise-low-score', maxScore })
    if(sources.some(source => source === 'anime.kodik_link' || source === 'kodik-api-player') && nativeEpisodeLinks === false) issues.push({ type:'player-link-not-native-episodes', sources })

    if(issues.length){
      voiceReports.push({
        voice,
        count:episodes.length,
        min,
        max,
        declaredMax:declaredMax || null,
        seasonNumbers,
        reliableTrue,
        reliableFalse,
        maxScore:maxScore || null,
        minScore:minScore || null,
        sources,
        nativeEpisodeLinks,
        issues,
        episodes:episodes.slice(0, 80)
      })
    }
  }

  if(extra.truncated){
    metadataIssues.push({ type:'audit-truncated-by-timeout', rowsLoaded:rows.length })
  }

  const severity = metadataIssues.length || voiceReports.some(v => v.issues.some(issue => ['max-episode-over-db','declared-count-over-db','mixed-season-numbers','long-franchise-unreliable-id','year-metadata-mismatch','episode-metadata-mismatch'].includes(issue.type)))
    ? 'critical'
    : voiceReports.length
      ? 'warning'
      : 'ok'

  return {
    slug:anime.slug,
    title:anime.title_ru || anime.title || anime.original_title || anime.slug,
    originalTitle:anime.original_title || null,
    year:number(anime.year) || null,
    expectedEpisodes:expected || null,
    kind:anime.kind || null,
    longFranchise,
    hasFullVoice,
    metadataIssues,
    voices:voiceReports,
    severity,
  }
}

async function loadAnimePage(limit, offset, deadlineMs){
  const select = 'slug,title,title_ru,original_title,year,episodes,kind,status,description_ru,kodik_id,shikimori_id'
  const timeout = Math.min(10000, millisecondsLeft(deadlineMs))
  const res = await supabaseRequest(`anime?select=${select}&order=slug.asc&limit=${limit}&offset=${offset}`, { method:'GET', timeout })
  const body = await readJson(res)
  if(!res.ok) throw new Error(`anime read failed: ${res.status} ${JSON.stringify(body).slice(0, 300)}`)
  return Array.isArray(body) ? body : []
}

async function loadEpisodes(slug, deadlineMs){
  const select = 'anime_slug,episode_number,provider,voice,embed_url,source,raw,updated_at'
  const pageSize = 1000
  const maxRows = 5000
  const all = []
  let truncated = false

  for(let offset = 0; offset < maxRows; offset += pageSize){
    if(deadlineReached(deadlineMs, 2500)){
      truncated = true
      break
    }

    const query = `anime_episodes?select=${select}&anime_slug=eq.${encodeURIComponent(slug)}&order=episode_number.asc&limit=${pageSize}&offset=${offset}`
    const timeout = Math.min(8000, millisecondsLeft(deadlineMs))
    const res = await supabaseRequest(query, { method:'GET', timeout })
    const body = await readJson(res)
    if(!res.ok) throw new Error(`episodes read failed for ${slug}: ${res.status} ${JSON.stringify(body).slice(0, 300)}`)
    const rows = Array.isArray(body) ? body : []
    all.push(...rows)
    if(rows.length < pageSize) break
  }

  return { rows:all, truncated }
}

async function handleGET(req){
  const startedAt = Date.now()
  const auth = verifyCronAccess(req)
  if(!auth.ok) return cronAuthError(auth)

  const url = req.nextUrl || new URL(req.url)
  if(url.searchParams.get('ping') === '1'){
    return json({ ok:true, route:'audit-player-integrity', mode:'ping', auth:auth.mode, hasSupabase:hasSupabase() })
  }

  const enabled = url.searchParams.get('enable') === '1'
  const limit = clamp(url.searchParams.get('limit') || DEFAULT_LIMIT, 1, MAX_LIMIT)
  const offset = Math.max(number(url.searchParams.get('offset') || 0), 0)
  const includeOk = url.searchParams.get('include_ok') === '1'
  const timeoutMs = clamp(url.searchParams.get('timeout') || DEFAULT_TIMEOUT_MS, 5000, MAX_TIMEOUT_MS)
  const deadlineMs = startedAt + timeoutMs

  if(!enabled) return json({ ok:false, error:'disabled', hint:'Добавь ?enable=1&token=CRON_SECRET. Для быстрой проверки маршрута можно открыть ?ping=1&token=CRON_SECRET.' }, 400)
  if(!hasSupabase()) return json({ ok:false, error:'supabase is not configured', hint:'Проверь ENABLE_SUPABASE_RUNTIME=1, NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.' }, 500)

  const anime = await loadAnimePage(limit, offset, deadlineMs)
  const reports = []
  const errors = []
  let stoppedEarly = false
  let checkedCount = 0

  for(const item of anime){
    if(deadlineReached(deadlineMs, 3000)){
      stoppedEarly = true
      errors.push({ type:'audit-timeout-budget', message:'Audit stopped early to return valid JSON before server timeout.' })
      break
    }

    try{
      const { rows, truncated } = await loadEpisodes(item.slug, deadlineMs)
      checkedCount += 1
      if(!rows.length){
        const expected = number(item.episodes)
        if(includeOk || expected){
          const emptyReport = {
            slug:item.slug,
            title:item.title_ru || item.title || item.original_title || item.slug,
            expectedEpisodes:expected || null,
            severity:expected ? 'warning' : 'ok',
            metadataIssues:truncated ? [{ type:'audit-truncated-by-timeout', rowsLoaded:0 }] : [],
            voices:expected ? [{ voice:'—', count:0, issues:[{ type:'no-player-episodes' }] }] : [],
          }
          if(includeOk || emptyReport.severity !== 'ok') reports.push(emptyReport)
        }
        continue
      }
      const report = analyzeRowsForAnime(item, rows, { truncated })
      if(includeOk || report.severity !== 'ok') reports.push(report)
    }catch(error){
      errors.push({ slug:item.slug, error:shortError(error) })
    }
  }

  const critical = reports.filter(report => report.severity === 'critical')
  const warnings = reports.filter(report => report.severity === 'warning')
  return json({
    ok:true,
    auth:auth.mode,
    requested:{ limit, offset, includeOk, timeoutMs },
    checked:checkedCount,
    loaded:anime.length,
    stoppedEarly,
    nextOffset:anime.length === limit && !stoppedEarly ? offset + limit : null,
    issues:{ total:reports.length, critical:critical.length, warnings:warnings.length, errors:errors.length },
    reports:reports.slice(0, 80),
    errors:errors.slice(0, 20),
    elapsedMs:Date.now() - startedAt,
    hint:'Ничего в базе не меняет — только аудит. Если stoppedEarly=true, повтори с меньшим limit или большим timeout, например limit=10&timeout=45000.'
  })
}

export async function GET(req){
  try{
    return await handleGET(req)
  }catch(error){
    return json({
      ok:false,
      source:'audit-player-integrity',
      error:'audit route failed',
      details:shortError(error),
      hint:'Route вернул JSON вместо пустого 500. Если details про Supabase/колонку — значит схема БД отличается от select или не выставлены env.'
    }, 500)
  }
}
