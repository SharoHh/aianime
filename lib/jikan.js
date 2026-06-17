import { translateGenres, makeRussianDescription } from '@/lib/ruContent'

const BASE = 'https://api.jikan.moe/v4'

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJsonWithTimeout(url, { timeout = 9000, retries = 1 } = {}){
  let lastError = null

  for(let attempt = 0; attempt <= retries; attempt++){
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try{
      const res = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Aianime/1.0 Jikan sync'
        }
      })

      if(res.status === 429 && attempt < retries){
        await sleep(1200 + attempt * 800)
        continue
      }

      if(!res.ok){
        const text = await res.text().catch(() => '')
        throw new Error(`Jikan ${res.status}: ${text.slice(0, 180)}`)
      }

      return await res.json()
    }catch(error){
      lastError = error
      if(attempt < retries) await sleep(700 + attempt * 600)
    }finally{
      clearTimeout(timer)
    }
  }

  throw lastError || new Error('Jikan request failed')
}

function cleanText(value){
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\[(Written by MAL Rewrite|MAL Rewrite)[^\]]*\]/gi, '')
    .trim()
}

function slugify(value, fallback){
  const slug = String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return slug || fallback
}

function pickPoster(item){
  const images = item?.images || {}
  return images?.webp?.large_image_url ||
    images?.jpg?.large_image_url ||
    images?.webp?.image_url ||
    images?.jpg?.image_url ||
    null
}

function pickBanner(item){
  const trailerImage = item?.trailer?.images?.maximum_image_url || item?.trailer?.images?.large_image_url
  return trailerImage || pickPoster(item)
}

function getGenres(item){
  const groups = [item?.genres, item?.explicit_genres, item?.themes, item?.demographics]
  return groups.flatMap(group => Array.isArray(group) ? group.map(x => x?.name).filter(Boolean) : [])
}

function getStudio(item){
  if(Array.isArray(item?.studios) && item.studios[0]?.name) return item.studios[0].name
  if(Array.isArray(item?.producers) && item.producers[0]?.name) return item.producers[0].name
  return null
}

function normalizeStatus(status){
  const raw = String(status || '').toLowerCase()
  if(raw.includes('currently airing')) return 'ongoing'
  if(raw.includes('not yet aired')) return 'anons'
  if(raw.includes('finished')) return 'completed'
  return status || null
}

function normalizeKind(type){
  const raw = String(type || '').toLowerCase()
  if(raw === 'tv') return 'tv'
  if(raw === 'movie') return 'movie'
  if(raw === 'ova') return 'ova'
  if(raw === 'ona') return 'ona'
  if(raw === 'special') return 'special'
  if(raw === 'music') return 'music'
  return raw || 'tv'
}

function yearFromItem(item){
  return item?.year ||
    Number(String(item?.aired?.from || item?.aired?.prop?.from?.year || '').slice(0, 4)) ||
    null
}

export async function fetchJikanAnimePage({ page = 1, limit = 25, order = 'popularity', status = '', type = '' } = {}){
  const safePage = Math.max(Number(page) || 1, 1)
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 25)
  const params = new URLSearchParams({
    page: String(safePage),
    limit: String(safeLimit),
    sfw: 'true',
  })

  const allowedOrder = new Set(['mal_id', 'title', 'start_date', 'end_date', 'episodes', 'score', 'scored_by', 'rank', 'popularity', 'members', 'favorites'])
  params.set('order_by', allowedOrder.has(order) ? order : 'popularity')
  params.set('sort', order === 'popularity' ? 'asc' : 'desc')

  if(status) params.set('status', status)
  if(type) params.set('type', type)

  return fetchJsonWithTimeout(`${BASE}/anime?${params.toString()}`, { timeout: 9000, retries: 2 })
}

export async function fetchJikanAnimePaged({ pages = 10, startPage = 1, limit = 25, order = 'popularity', delay = 900, status = '', type = '' } = {}){
  const safeStartPage = Math.max(Number(startPage) || 1, 1)
  const safePages = Math.min(Math.max(Number(pages) || 1, 1), 40)
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 25)
  const safeDelay = Math.min(Math.max(Number(delay) || 900, 400), 4000)
  const all = []

  for(let offset = 0; offset < safePages; offset++){
    const page = safeStartPage + offset
    const payload = await fetchJikanAnimePage({ page, limit: safeLimit, order, status, type })
    const chunk = Array.isArray(payload?.data) ? payload.data : []
    if(!chunk.length) break

    all.push(...chunk)

    const hasNext = payload?.pagination?.has_next_page
    if(chunk.length < safeLimit || hasNext === false) break
    if(offset < safePages - 1) await sleep(safeDelay)
  }

  return all
}


function splitSearchQueryVariants(value){
  const raw = String(value || '').replace(/([а-яё])([A-Z])/giu, '$1 $2').replace(/\s+/g, ' ').trim()
  if(!raw) return []
  const latin = raw.replace(/[^A-Za-z0-9\s:'’.,!?#&+\-]/g, ' ').replace(/\s+/g, ' ').trim()
  const cyrillic = raw.replace(/[^А-Яа-яЁё0-9\s:'’.,!?#&+\-]/g, ' ').replace(/\s+/g, ' ').trim()
  const miniClean = latin
    .replace(/\bmini\s+anime\b/ig, 'mini anime')
    .replace(/\bmini\b/ig, 'mini')
    .trim()
  const noMini = latin.replace(/\bmini\s+anime\b/ig, '').replace(/\bmini\b/ig, '').replace(/\s+/g, ' ').trim()
  return Array.from(new Set([raw, latin, miniClean, noMini, cyrillic].filter(q => q && q.length >= 2))).slice(0, 5)
}

export function getJikanSearchQueryVariants(value){
  return splitSearchQueryVariants(value)
}

export async function fetchJikanAnimeSearch({ q = '', page = 1, limit = 10, type = '', status = '', order = 'popularity' } = {}){
  const safeQ = String(q || '').trim()
  if(!safeQ) return { data:[], pagination:{ has_next_page:false } }
  const safePage = Math.max(Number(page) || 1, 1)
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 25)
  const params = new URLSearchParams({
    q: safeQ,
    page: String(safePage),
    limit: String(safeLimit),
    sfw: 'true',
  })
  const allowedOrder = new Set(['mal_id', 'title', 'start_date', 'end_date', 'episodes', 'score', 'scored_by', 'rank', 'popularity', 'members', 'favorites'])
  params.set('order_by', allowedOrder.has(order) ? order : 'popularity')
  params.set('sort', order === 'popularity' ? 'asc' : 'desc')
  if(type) params.set('type', String(type).toLowerCase())
  if(status) params.set('status', status)
  return fetchJsonWithTimeout(`${BASE}/anime?${params.toString()}`, { timeout: 10000, retries: 2 })
}

export async function searchJikanAnimeVariants({ q = '', limit = 10, type = '', status = '', order = 'popularity' } = {}){
  const variants = splitSearchQueryVariants(q)
  const seen = new Set()
  const results = []
  const attempts = []

  for(const variant of variants){
    try{
      const payload = await fetchJikanAnimeSearch({ q: variant, limit, type, status, order })
      const chunk = Array.isArray(payload?.data) ? payload.data : []
      attempts.push({ q: variant, count: chunk.length })
      for(const item of chunk){
        const key = String(item?.mal_id || item?.url || item?.title || '')
        if(!key || seen.has(key)) continue
        seen.add(key)
        results.push({ ...item, __aianime_search_query: variant })
      }
      if(results.length >= limit) break
      await sleep(650)
    }catch(error){
      attempts.push({ q: variant, error: error?.message || String(error) })
    }
  }

  return { variants, attempts, data: results.slice(0, limit) }
}


function normalizeSearchTitle(value){
  return String(value || '')
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/●+/g, ' ')
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .replace(/\b(the|a|an|anime|mini|petit|chibi|ona|special|tv|movie)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function searchTitleTokens(value){
  return normalizeSearchTitle(value)
    .split(' ')
    .map(x => x.trim())
    .filter(x => x.length >= 3)
}

function candidateTitleValues(item){
  const titles = []
  const push = value => {
    const text = String(value || '').trim()
    if(text && !titles.includes(text)) titles.push(text)
  }

  push(item?.title)
  push(item?.title_english)
  push(item?.title_japanese)
  if(Array.isArray(item?.title_synonyms)) item.title_synonyms.forEach(push)
  if(Array.isArray(item?.titles)) item.titles.forEach(entry => push(entry?.title))
  return titles
}

export function scoreJikanSearchCandidate(item, query){
  const rawQuery = String(query || '').trim()
  const queryVariants = splitSearchQueryVariants(rawQuery)
  const queryTexts = Array.from(new Set([rawQuery, ...queryVariants].filter(Boolean)))
  const queryTokens = searchTitleTokens(rawQuery)
  const candidateTitles = candidateTitleValues(item)
  const candidateTexts = candidateTitles.map(normalizeSearchTitle).filter(Boolean)

  let best = 0
  let matchedTitle = ''
  let matchedQuery = ''

  for(const queryText of queryTexts){
    const qNorm = normalizeSearchTitle(queryText)
    const qTokens = searchTitleTokens(queryText)
    if(!qNorm || !qTokens.length) continue

    for(let i = 0; i < candidateTexts.length; i++){
      const titleNorm = candidateTexts[i]
      if(!titleNorm) continue
      const titleTokens = searchTitleTokens(titleNorm)
      const querySet = new Set(qTokens)
      const titleSet = new Set(titleTokens)
      const overlap = qTokens.filter(token => titleSet.has(token)).length
      const coverage = overlap / Math.max(qTokens.length, 1)
      const reverseCoverage = titleTokens.filter(token => querySet.has(token)).length / Math.max(titleTokens.length, 1)

      let score = Math.round((coverage * 65) + (reverseCoverage * 25))
      if(titleNorm === qNorm) score += 80
      else if(titleNorm.includes(qNorm) || qNorm.includes(titleNorm)) score += 42
      if(/mini/i.test(rawQuery) && /mini|petit|chibi|ぷち|ミニ/i.test(candidateTitles[i] || '')) score += 18
      if(/yubisaki/i.test(rawQuery) && /yubisaki/i.test(candidateTitles.join(' '))) score += 30
      if(/renren/i.test(rawQuery) && /renren/i.test(candidateTitles.join(' '))) score += 24
      if(/affection/i.test(rawQuery) && /affection/i.test(candidateTitles.join(' '))) score += 22

      if(score > best){
        best = score
        matchedTitle = candidateTitles[i]
        matchedQuery = queryText
      }
    }
  }

  const hardQueryTokens = queryTokens.filter(token => !['mini','anime','ona','special','petit'].includes(token))
  const allCandidate = normalizeSearchTitle(candidateTitles.join(' '))
  const missingHardTokens = hardQueryTokens.filter(token => !allCandidate.includes(token))
  if(hardQueryTokens.length >= 2 && missingHardTokens.length >= Math.ceil(hardQueryTokens.length / 2)){
    best = Math.min(best, 44)
  }

  return { score:best, matchedTitle, matchedQuery, titles:candidateTitles }
}

export function pickBestJikanSearchCandidate(items = [], query = '', { minScore = 70 } = {}){
  const ranked = (Array.isArray(items) ? items : [])
    .map(item => ({ item, relevance: scoreJikanSearchCandidate(item, query) }))
    .sort((a, b) => Number(b.relevance?.score || 0) - Number(a.relevance?.score || 0))

  const best = ranked[0] || null
  return {
    item: best && Number(best.relevance?.score || 0) >= minScore ? best.item : null,
    best,
    ranked,
    minScore,
  }
}


const JIKAN_SCHEDULE_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export function getJikanScheduleDays(){
  return [...JIKAN_SCHEDULE_DAYS]
}

export async function fetchJikanScheduleDay({ filter = 'monday', page = 1, limit = 25 } = {}){
  const safeFilter = JIKAN_SCHEDULE_DAYS.includes(String(filter).toLowerCase()) ? String(filter).toLowerCase() : 'monday'
  const safePage = Math.max(Number(page) || 1, 1)
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 25)
  const params = new URLSearchParams({
    filter: safeFilter,
    page: String(safePage),
    limit: String(safeLimit),
    sfw: 'true',
  })

  return fetchJsonWithTimeout(`${BASE}/schedules?${params.toString()}`, { timeout: 10000, retries: 2 })
}

export async function fetchJikanScheduleWeek({ limit = 25, pagesPerDay = 1, delay = 900 } = {}){
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 25)
  const safePages = Math.min(Math.max(Number(pagesPerDay) || 1, 1), 4)
  const safeDelay = Math.min(Math.max(Number(delay) || 900, 400), 4000)
  const rows = []

  for(const day of JIKAN_SCHEDULE_DAYS){
    for(let page = 1; page <= safePages; page++){
      const payload = await fetchJikanScheduleDay({ filter: day, page, limit: safeLimit })
      const chunk = Array.isArray(payload?.data) ? payload.data : []
      rows.push(...chunk.map(item => ({ ...item, __aianime_schedule_day: day })))

      const hasNext = payload?.pagination?.has_next_page
      if(chunk.length < safeLimit || hasNext === false) break
      if(page < safePages) await sleep(safeDelay)
    }

    await sleep(safeDelay)
  }

  return rows
}

export async function fetchJikanAnimeDetails(malId){
  const id = Number(malId)
  if(!Number.isFinite(id) || id <= 0) throw new Error('Invalid MAL id')
  const payload = await fetchJsonWithTimeout(`${BASE}/anime/${id}/full`, { timeout: 9000, retries: 1 })
  return payload?.data || null
}

export function normalizeJikanAnime(item, details = null){
  const full = details || item || {}
  const malId = Number(full.mal_id || item?.mal_id)
  const title = full.title_english || full.title || item?.title || `Anime ${malId || ''}`.trim()
  const originalTitle = full.title || full.title_japanese || title
  const slug = `${malId || 'mal'}-${slugify(full.title || title, 'anime')}`
  const rawGenres = getGenres(full).length ? getGenres(full) : getGenres(item)
  const genres = translateGenres(rawGenres)
  const episodes = Number(full.episodes || item?.episodes || 0) || 0
  const score = Number(full.score || item?.score || 0) || null

  return {
    mal_id: Number.isFinite(malId) ? malId : null,
    // Legacy DB field kept for old schema compatibility. In Jikan mode this stores MAL id.
    shikimori_id: Number.isFinite(malId) ? malId : null,
    slug,
    title,
    original_title: originalTitle || null,
    description: cleanText(full.synopsis || full.background || item?.synopsis),
    description_ru: makeRussianDescription({ title, original_title: originalTitle, genres, kind: normalizeKind(full.type || item?.type), status: normalizeStatus(full.status || item?.status), year: yearFromItem(full) || yearFromItem(item), episodes }),
    status: normalizeStatus(full.status || item?.status),
    kind: normalizeKind(full.type || item?.type),
    year: yearFromItem(full) || yearFromItem(item),
    episodes,
    rating: score,
    poster_url: pickPoster(full) || pickPoster(item),
    banner_url: pickBanner(full) || pickBanner(item),
    genres,
    studio: getStudio(full) || getStudio(item),
    provider: 'jikan',
    raw: full
  }
}
