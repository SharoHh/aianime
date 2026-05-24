import { anime as seedAnime } from '@/lib/data'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'

const ANIME_SELECT = [
  'id','slug','title','title_ru','original_title','title_orig','title_orig_kodik','description','description_ru',
  'poster_url','banner_url','rating','score','popularity','episodes','status','kind','year','genres','studio','provider',
  'mal_id','shikimori_id','kodik_id','kodik_link','kodik_type','translation_title','translation_type','quality','kodik_quality','kodik_screenshots'
].join(',')

const EPISODE_SELECT = 'id,anime_slug,episode_number,title,provider,voice,embed_url,hls_url,duration,status,source'
const LIST_CACHE_TTL = Number(process.env.AIANIME_LIST_CACHE_TTL_MS || 45000)
const EPISODE_CACHE_TTL = Number(process.env.AIANIME_EPISODE_CACHE_TTL_MS || 60000)
const listCache = new Map()
const episodeCache = new Map()

function readCache(map, key, ttl){
  const hit = map.get(key)
  if(!hit) return null
  if(Date.now() - hit.at > ttl){
    map.delete(key)
    return null
  }
  return hit.value
}

function writeCache(map, key, value){
  map.set(key, { at: Date.now(), value })
  if(map.size > 30){
    const first = map.keys().next().value
    if(first) map.delete(first)
  }
  return value
}

function isMissingPoster(url){
  return !url || /missing_(original|preview|x160|x96)\.jpg/i.test(url)
}

function isAllowedRemoteImage(url){
  try{
    const parsed = new URL(String(url || ''))
    const host = parsed.hostname.toLowerCase()
    return parsed.protocol === 'https:' && (
      host === 'cdn.myanimelist.net' ||
      host.endsWith('.myanimelist.net') ||
      host === 'i.kodikres.com' ||
      host.endsWith('.kodikres.com') ||
      host === 'shikimori.one' ||
      host.endsWith('.shikimori.one')
    )
  }catch{
    return false
  }
}

function imageProxyMode(){
  // На проде часть внешних CDN может не отдавать постеры пользователям напрямую.
  // Поэтому по умолчанию используем кеширующий /api/image, а не прямую ссылку.
  return String(process.env.AIANIME_IMAGE_PROXY_MODE || process.env.NEXT_PUBLIC_AIANIME_IMAGE_PROXY_MODE || 'always').toLowerCase()
}

function proxyImage(url, fallback){
  if(isMissingPoster(url)) return fallback || null
  const raw = String(url || '').trim()
  if(!raw) return fallback || null
  if(raw.startsWith('/')) return raw

  if(isAllowedRemoteImage(raw)){
    // Для VPS по умолчанию быстрее отдавать постеры напрямую с CDN.
    // /api/image оставляем как режим fallback, если CDN у пользователей начнёт резаться.
    if(imageProxyMode() !== 'always') return raw
    const safeFallback = fallback && String(fallback).startsWith('/') ? fallback : '/posters/magic2.svg'
    return `/api/image?url=${encodeURIComponent(raw)}&fallback=${encodeURIComponent(safeFallback)}`
  }

  return fallback || null
}

function normalizeStatus(status){
  if(!status) return 'completed'
  if(status === 'released') return 'completed'
  if(status === 'ongoing') return 'ongoing'
  if(status === 'anons') return 'anons'
  return status
}

function localPoster(index = 0){
  return seedAnime[index % seedAnime.length]?.poster || '/posters/magic2.svg'
}

function getMalId(row){
  return row?.mal_id ?? row?.malId ?? row?.shikimori_id ?? row?.shikimoriId ?? null
}

function remoteImagesEnabled(){
  return process.env.ENABLE_REMOTE_IMAGES === '1' || process.env.NEXT_PUBLIC_ENABLE_REMOTE_IMAGES === '1'
}

function pickRawPoster(row){
  const candidates = [
    row?.poster,
    row?.image_url,
    row?.image,
    row?.raw?.poster_url,
    row?.raw?.images?.webp?.large_image_url,
    row?.raw?.images?.jpg?.large_image_url,
    row?.raw?.images?.webp?.image_url,
    row?.raw?.images?.jpg?.image_url,
    row?.raw?.data?.images?.webp?.large_image_url,
    row?.raw?.data?.images?.jpg?.large_image_url,
  ]
  return candidates.find(Boolean) || null
}

function jikanPoster(id, fallback){
  if(!remoteImagesEnabled()) return fallback || null
  const numericId = Number(id)
  if(!Number.isFinite(numericId) || numericId <= 0) return fallback || null
  const safeFallback = fallback && String(fallback).startsWith('/') ? fallback : '/posters/magic2.svg'
  return `/api/poster?id=${numericId}&fallback=${encodeURIComponent(safeFallback)}`
}

function cleanGenres(genres){
  if(Array.isArray(genres)) return genres.filter(Boolean)
  if(typeof genres === 'string') return genres.split(',').map(g => g.trim()).filter(Boolean)
  return []
}

export function normalizeSeedForDb(item){
  return {
    shikimori_id: item.shikimoriId || item.shikimori_id || null,
    slug: item.slug,
    title: item.title,
    original_title: item.originalTitle || item.original_title || null,
    description: item.description || null,
    status: item.status || null,
    kind: item.kind || null,
    year: item.year || null,
    episodes: item.episodes || 0,
    rating: Number(item.score || item.rating || 0) || null,
    poster_url: item.poster || item.poster_url || null,
    banner_url: item.banner || item.banner_url || item.poster || null,
    genres: Array.isArray(item.genres) ? item.genres : [],
    studio: item.studio || null,
    provider: item.provider || 'seed',
    raw: item,
    updated_at: new Date().toISOString(),
  }
}

export function mapDbAnime(row, index = 0){
  const fallbackPoster = localPoster(index)
  const malId = getMalId(row)
  const posterSource = row.poster_url || pickRawPoster(row)
  const posterFromDb = proxyImage(posterSource, fallbackPoster)
  const remotePoster = posterFromDb ? null : jikanPoster(malId, fallbackPoster)
  const kodikShot = Array.isArray(row.kodik_screenshots) && row.kodik_screenshots[0] ? proxyImage(row.kodik_screenshots[0], fallbackPoster) : null
  const poster = posterFromDb || remotePoster || kodikShot || fallbackPoster
  const banner = proxyImage(row.banner_url, poster) || poster
  const score = Number(row.rating || row.score || 0) || 0
  const episodes = Number(row.episodes || 0) || 0
  const status = normalizeStatus(row.status)
  const kind = row.kind || 'tv'
  const genres = cleanGenres(row.genres)
  const episodeCount = Math.max(1, Math.min(episodes || 12, 64))

  return {
    id: row.id || malId || index + 1,
    malId: row.mal_id || malId || null,
    shikimoriId: row.shikimori_id || null,
    slug: row.slug,
    title: row.title_ru || row.title || row.original_title || 'Без названия',
    displayTitle: row.title_ru || row.title || row.original_title || 'Без названия',
    originalTitle: row.title_orig_kodik || row.original_title || row.title || '',
    englishTitle: row.title || row.original_title || '',
    meta: kind === 'movie' ? 'Фильм' : `${episodes || '?'} серий`,
    status,
    kind,
    year: row.year || null,
    rating: score ? score.toFixed(1) : '—',
    score,
    popularity: Number(row.popularity || row.rating || 0) || score,
    episodes,
    genres: genres.length ? genres : ['Аниме'],
    poster,
    banner,
    progress: 0,
    studio: row.studio || '—',
    titleRu: row.title_ru || null,
    translationTitle: row.translation_title || null,
    translationType: row.translation_type || null,
    quality: row.quality || null,
    kodikId: row.kodik_id || null,
    kodikLink: row.kodik_link || null,
    kodikType: row.kodik_type || null,
    kodikScreenshots: Array.isArray(row.kodik_screenshots) ? row.kodik_screenshots : [],
    nextEpisode: status === 'ongoing' ? 'Скоро' : '—',
    description: row.description_ru || row.description || 'Описание скоро появится после следующей синхронизации.',
    descriptionRu: row.description_ru || null,
    mood: [],
    episodesList: Array.from({ length: episodeCount }, (_, i) => i + 1)
  }
}

function mapSeedAnime(item){
  const fallbackPoster = item.poster || '/posters/magic2.svg'
  return {
    ...item,
    displayTitle: item.title,
    poster: fallbackPoster,
    banner: item.banner || fallbackPoster,
    status: normalizeStatus(item.status),
    score: Number(item.score || item.rating || 0) || 0,
    rating: item.rating || (Number(item.score || 0) ? Number(item.score).toFixed(1) : '—'),
    popularity: Number(item.score || item.rating || 0) || 0,
    genres: Array.isArray(item.genres) ? item.genres : ['Аниме'],
    episodesList: Array.isArray(item.episodesList) && item.episodesList.length ? item.episodesList : [1]
  }
}

async function parseSupabaseRows(res, label){
  if(!res.ok) throw new Error(`${label}: ${res.status} ${await res.text()}`)
  const rows = await res.json()
  if(!Array.isArray(rows)) throw new Error(`${label}: invalid response`)
  return rows
}

async function readSupabaseTable(table, limit){
  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 1200)

  // В проде схема Supabase может догоняться миграциями. Если в точечном select
  // отсутствует хоть одна необязательная колонка, PostgREST возвращает 400 и сайт
  // откатывался на seed из 40 тайтлов. Поэтому основной путь — select=*:
  // он устойчивый и не ломает каталог из-за необязательных колонок.
  const queryAll = `${table}?select=*&order=rating.desc.nullslast&limit=${safeLimit}`
  const resAll = await supabaseRequest(queryAll, { method: 'GET', timeout: 12000 })
  return parseSupabaseRows(resAll, table)
}

async function readAnimeBySlug(table, slug){
  const safeSlug = encodeURIComponent(String(slug || '').trim())
  if(!safeSlug) return null
  const query = `${table}?select=*&slug=eq.${safeSlug}&limit=1`
  const res = await supabaseRequest(query, { method: 'GET', timeout: 9000 })
  const rows = await parseSupabaseRows(res, `${table} slug`)
  return rows[0] || null
}

export async function getAnimeList({ limit = 300 } = {}){
  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 1200)
  const fallback = seedAnime.map(mapSeedAnime)
  if(!hasSupabase()) return fallback.slice(0, safeLimit)

  const cacheKey = `anime-list:${safeLimit}`
  const cached = readCache(listCache, cacheKey, LIST_CACHE_TTL)
  if(cached) return cached

  try{
    let rows = []
    try{
      rows = await readSupabaseTable('anime', safeLimit)
    }catch(firstError){
      rows = await readSupabaseTable('anime_titles', safeLimit)
    }
    if(!rows.length) return fallback.slice(0, safeLimit)
    return writeCache(listCache, cacheKey, rows.map(mapDbAnime))
  }catch(error){
    console.warn('Supabase anime read failed:', error?.message || error)
    return fallback.slice(0, safeLimit)
  }
}

export async function getAnimeBySlugFromRepo(slug){
  const normalizedSlug = String(slug || '').trim()
  if(!normalizedSlug) return seedAnime[0]

  if(hasSupabase()){
    const cacheKey = `anime-slug:${normalizedSlug}`
    const cached = readCache(listCache, cacheKey, LIST_CACHE_TTL)
    if(cached) return cached
    try{
      let row = null
      try{
        row = await readAnimeBySlug('anime', normalizedSlug)
      }catch(firstError){
        row = await readAnimeBySlug('anime_titles', normalizedSlug)
      }
      if(row) return writeCache(listCache, cacheKey, mapDbAnime(row, 0))
    }catch(error){
      console.warn('Supabase anime slug read failed:', error?.message || error)
    }
  }

  const list = await getAnimeList({ limit: 500 })
  return list.find(item => item.slug === normalizedSlug) || seedAnime.find(item => item.slug === normalizedSlug) || list[0] || seedAnime[0]
}

export function getSimilarFromList(item, list, limit = 6){
  const genres = Array.isArray(item.genres) ? item.genres : []
  const scored = list
    .filter(a => a.slug !== item.slug)
    .map(a => {
      const matches = a.genres?.filter(g => genres.includes(g)).length || 0
      const yearBonus = item.year && a.year ? Math.max(0, 5 - Math.abs(Number(item.year) - Number(a.year)) / 2) : 0
      return { item: a, weight: matches * 12 + Number(a.score || 0) + yearBonus }
    })
    .filter(x => x.weight > 0)
    .sort((a,b) => b.weight - a.weight)
    .map(x => x.item)

  return scored.slice(0, limit)
}

export function searchAnimeLocally(query, list, limit = 8){
  const text = String(query || '').trim().toLowerCase()
  if(!text) return list.slice(0, limit)

  const moodWords = {
    'вечер': ['Романтика','Повседневность','Драма'],
    'уют': ['Романтика','Повседневность','Комедия'],
    'мрач': ['Психология','Триллер','Драма','Экшен'],
    'экшен': ['Экшен','Приключения','Сёнен'],
    'роман': ['Романтика','Драма'],
    'умн': ['Психология','Триллер','Фантастика'],
    'фэнтези': ['Фэнтези','Приключения'],
  }

  return list
    .map(item => {
      const hay = `${item.title} ${item.originalTitle} ${item.description} ${item.genres.join(' ')}`.toLowerCase()
      let weight = hay.includes(text) ? 30 : 0
      for(const [word, genres] of Object.entries(moodWords)){
        if(text.includes(word)) weight += item.genres.some(g => genres.includes(g)) ? 18 : 0
      }
      for(const token of text.split(/\s+/).filter(Boolean)){
        if(hay.includes(token)) weight += 5
      }
      weight += Number(item.score || 0)
      return { item, weight }
    })
    .filter(x => x.weight > 5)
    .sort((a,b) => b.weight - a.weight)
    .slice(0, limit)
    .map(x => x.item)
}

export function normalizeEpisodeForDb(episode){
  const n = Number(episode.episode_number || episode.episodeNumber || episode.number || 1) || 1
  return {
    anime_slug: String(episode.anime_slug || episode.animeSlug || '').trim(),
    episode_number: n,
    title: episode.title || `Серия ${n}`,
    provider: episode.provider || 'manual',
    voice: episode.voice || 'default',
    embed_url: episode.embed_url || episode.embedUrl || null,
    hls_url: episode.hls_url || episode.hlsUrl || null,
    duration: Number(episode.duration || 0) || null,
    status: episode.status || 'draft',
    source: episode.source || 'manual',
    raw: episode.raw || episode,
    updated_at: new Date().toISOString(),
  }
}

function mapDbEpisode(row){
  return {
    id: row.id,
    animeSlug: row.anime_slug,
    episodeNumber: Number(row.episode_number || 1),
    title: row.title || `Серия ${row.episode_number || 1}`,
    provider: row.provider || 'manual',
    voice: row.voice || 'default',
    embedUrl: row.embed_url || null,
    hlsUrl: row.hls_url || null,
    duration: row.duration || null,
    status: row.status || 'draft',
    source: row.source || 'manual',
  }
}

export async function getEpisodesBySlug(slug, fallbackCount = 12){
  const normalizedSlug = String(slug || '').trim()
  if(!normalizedSlug) return []

  if(hasSupabase()){
    const cacheKey = `episodes:${normalizedSlug}`
    const cached = readCache(episodeCache, cacheKey, EPISODE_CACHE_TTL)
    if(cached) return cached
    try{
      const query = `anime_episodes?select=${EPISODE_SELECT}&anime_slug=eq.${encodeURIComponent(normalizedSlug)}&order=episode_number.asc&order=voice.asc&limit=200`
      const res = await supabaseRequest(query, { method: 'GET', timeout: 8000 })
      if(res.ok){
        const rows = await res.json()
        if(Array.isArray(rows) && rows.length) return writeCache(episodeCache, cacheKey, rows.map(mapDbEpisode))
      }
    }catch(error){
      console.warn('Supabase episodes read failed:', error?.message || error)
    }
  }

  const count = Math.max(1, Math.min(Number(fallbackCount) || 12, 64))
  return Array.from({ length: count }, (_, index) => ({
    id: `fallback-${normalizedSlug}-${index + 1}`,
    animeSlug: normalizedSlug,
    episodeNumber: index + 1,
    title: `Серия ${index + 1}`,
    provider: 'future-auto',
    voice: 'default',
    embedUrl: null,
    hlsUrl: null,
    status: 'placeholder',
    source: 'fallback',
  }))
}
