// AIanime v125: real popularity scoring from user actions with short runtime cache.
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'

const POPULARITY_CACHE_TTL = Number(process.env.AIANIME_POPULARITY_CACHE_TTL_MS || 300000)
const STALE_CACHE_TTL = Number(process.env.AIANIME_POPULARITY_STALE_TTL_MS || 1800000)
const cache = new Map()
const pending = new Map()

function readCache(key, ttl){
  const hit = cache.get(key)
  if(!hit) return null
  if(Date.now() - hit.at > ttl){
    cache.delete(key)
    return null
  }
  return hit.value
}

function writeCache(key, value){
  cache.set(key, { at:Date.now(), value })
  return value
}

function withPending(key, task){
  const existing = pending.get(key)
  if(existing) return existing
  const promise = Promise.resolve().then(task).finally(() => pending.delete(key))
  pending.set(key, promise)
  return promise
}

function slugOf(row){
  return String(row?.anime_slug || row?.slug || '').trim()
}

function dateOf(value){
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}


function hasCyrillicText(value){
  return /[А-Яа-яЁё]/.test(String(value || ''))
}

function unwrapPosterSource(value){
  const raw = String(value || '').trim()
  if(!raw) return ''
  try{
    const parsed = new URL(raw, 'https://aianime.local')
    if(parsed.pathname === '/api/image' || parsed.pathname === '/_next/image'){
      const nested = parsed.searchParams.get('url')
      if(nested) return decodeURIComponent(nested)
    }
  }catch{}
  return raw
}

function isPlaceholderPoster(value){
  const source = unwrapPosterSource(value)
  if(!source) return true
  let path = source.split(/[?#]/)[0].toLowerCase()
  try{ path = decodeURIComponent(new URL(source, 'https://aianime.local').pathname).toLowerCase() }catch{}
  if(/^\/(?:posters|banners)\/[^/?#]+\.svg$/i.test(path)) return true
  return /(?:^|\/)(?:placeholder|no[-_]?poster|default(?:-poster)?)(?:[._/-]|$)/i.test(path)
}

function isHomeReadyAnime(item){
  if(!item?.slug || !item?.title) return false
  const poster = item.poster || item.poster_url || ''
  const hasPoster = !isPlaceholderPoster(poster)
  const hasRuTitle = hasCyrillicText(item.titleRu || item.title_ru || item.displayTitle || item.title)
  const hasDescription = String(item.description || item.description_ru || '').replace(/\s+/g, ' ').trim().length >= 60
  // Новые mini/special/OVA из bulk-импорта не должны вылезать на главную голыми карточками.
  // Они останутся в каталоге/поиске, а на главную попадут после обогащения title_ru/poster/description/Kodik.
  return hasPoster && (hasRuTitle || hasDescription)
}

function recencyMultiplier(value){
  const time = dateOf(value)
  if(!time) return 0.45
  const ageMs = Math.max(0, Date.now() - time)
  const day = 24 * 60 * 60 * 1000
  if(ageMs <= day) return 1.65
  if(ageMs <= 3 * day) return 1.35
  if(ageMs <= 7 * day) return 1.0
  if(ageMs <= 21 * day) return 0.65
  if(ageMs <= 45 * day) return 0.38
  return 0.18
}

function statFor(map, slug){
  const current = map.get(slug) || {
    slug,
    score:0,
    views:0,
    clicks:0,
    continues:0,
    favorites:0,
    ratings:0,
    ratingSum:0,
    lastActionAt:0
  }
  map.set(slug, current)
  return current
}

function addAction(map, slug, points, field, at){
  if(!slug) return
  const stat = statFor(map, slug)
  stat.score += points * recencyMultiplier(at)
  stat[field] = (stat[field] || 0) + 1
  const time = dateOf(at)
  if(time > stat.lastActionAt) stat.lastActionAt = time
}

async function readJson(path, timeout = 4500){
  try{
    const res = await supabaseRequest(path, { method:'GET', timeout })
    if(!res.ok) return []
    const rows = await res.json().catch(() => [])
    return Array.isArray(rows) ? rows : []
  }catch{
    return []
  }
}

async function readPopularityFromSupabase(){
  if(!hasSupabase()) return new Map()

  const [events, history, favorites, ratings] = await Promise.all([
    readJson('anime_popularity_events?select=anime_slug,event_type,created_at&order=created_at.desc&limit=2000', 3500),
    readJson('user_history?select=anime_slug,watched_at,updated_at,progress&order=watched_at.desc&limit=1600', 4500),
    readJson('user_favorites?select=anime_slug,saved_at,updated_at&order=saved_at.desc&limit=1600', 4500),
    readJson('user_ratings?select=anime_slug,rating,updated_at&order=updated_at.desc&limit=2400', 4500)
  ])

  const map = new Map()

  for(const row of events){
    const type = String(row?.event_type || '').toLowerCase()
    const points = type === 'view' ? 1.2 : type === 'click' ? 2.2 : type === 'continue' ? 4 : type === 'favorite' ? 8 : type === 'rating' ? 7 : 1
    addAction(map, slugOf(row), points, type === 'click' ? 'clicks' : 'views', row?.created_at)
  }

  for(const row of history){
    const progress = Math.max(0, Math.min(100, Number(row?.progress || 0) || 0))
    addAction(map, slugOf(row), 5 + progress / 18, 'continues', row?.watched_at || row?.updated_at)
  }

  for(const row of favorites){
    addAction(map, slugOf(row), 11, 'favorites', row?.saved_at || row?.updated_at)
  }

  for(const row of ratings){
    const slug = slugOf(row)
    const rating = Math.max(0, Math.min(5, Number(row?.rating || 0) || 0))
    if(!slug || !rating) continue
    const stat = statFor(map, slug)
    stat.ratingSum += rating
    addAction(map, slug, 5 + rating * 1.6, 'ratings', row?.updated_at)
  }

  for(const stat of map.values()){
    stat.averageRating = stat.ratings ? stat.ratingSum / stat.ratings : 0
    stat.totalActions = stat.views + stat.clicks + stat.continues + stat.favorites + stat.ratings
    stat.score = Math.round(stat.score * 100) / 100
  }

  return map
}

export async function getPopularitySnapshot(){
  const cacheKey = 'popularity:v123'
  const cached = readCache(cacheKey, POPULARITY_CACHE_TTL)
  if(cached) return cached
  const stale = readCache(cacheKey, STALE_CACHE_TTL)
  if(stale) return stale
  return withPending(cacheKey, async () => writeCache(cacheKey, await readPopularityFromSupabase()))
}

export function decorateAnimeWithPopularity(list, popularityMap){
  if(!Array.isArray(list) || !list.length) return []
  const map = popularityMap instanceof Map ? popularityMap : new Map()
  return list.map((item, index) => {
    const stat = map.get(item?.slug)
    const fallbackScore = Math.max(0, Number(item?.popularity || 0) || 0) + (String(item?.status || '').toLowerCase() === 'ongoing' ? 5 : 0) + Math.max(0, Number(item?.year || 0) - 2016) * 0.2 - index * 0.004
    return {
      ...item,
      popularityStats: stat || null,
      livePopularityScore: stat?.score ? stat.score : fallbackScore,
      livePopularityActions: stat?.totalActions || 0,
      livePopularityLabel: stat?.totalActions ? 'Сейчас смотрят' : 'В тренде'
    }
  })
}

export function rankPopularAnime(list, limit = 20){
  const safe = Array.isArray(list) ? list : []
  return [...safe]
    .filter(item => item?.slug && item?.title)
    .sort((a,b) => {
      const actionDiff = Number(b.livePopularityActions || 0) - Number(a.livePopularityActions || 0)
      if(actionDiff) return actionDiff
      return Number(b.livePopularityScore || 0) - Number(a.livePopularityScore || 0)
    })
    .slice(0, limit)
}

export function rankNewAnime(list, limit = 12){
  const safe = Array.isArray(list) ? list : []
  return [...safe]
    .filter(isHomeReadyAnime)
    .sort((a,b) => {
      const bDate = dateOf(b?.addedAt || b?.createdAt || b?.updatedAt)
      const aDate = dateOf(a?.addedAt || a?.createdAt || a?.updatedAt)
      if(bDate !== aDate) return bDate - aDate
      const yearDiff = Number(b?.year || 0) - Number(a?.year || 0)
      if(yearDiff) return yearDiff
      return Number(b?.id || 0) - Number(a?.id || 0)
    })
    .slice(0, limit)
}
