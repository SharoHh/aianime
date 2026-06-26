// AIanime v123: community rating + created timestamps for latest/popularity blocks.
import { anime as seedAnime } from '@/lib/data'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { isSeedCatalogFallbackAllowed, catalogGuardReason, minProductionCatalogSize } from '@/lib/catalogGuard'
import { translateGenres, preferRussianDescription, makeRussianDescription, cleanPublicText } from '@/lib/ruContent'
import { filterAndSortAnime } from '@/lib/searchRelevance'
import { filterRestrictedAnime, isRestrictedAnimeSlug, isAnimeRestricted, getAnimeRestriction } from '@/lib/contentRestrictions'

const ANIME_SELECT = [
  'id','slug','title','title_ru','original_title','title_orig','title_orig_kodik','description','description_ru',
  'poster_url','banner_url','rating','score','popularity','episodes','status','kind','year','genres','studio','provider',
  'mal_id','shikimori_id','kodik_id','kodik_link','kodik_type','translation_title','translation_type','quality','kodik_quality','kodik_screenshots','created_at','updated_at'
].join(',')
const ANIME_DETAIL_SELECT = `${ANIME_SELECT},raw`

const EPISODE_SELECT = 'id,anime_slug,episode_number,title,provider,voice,embed_url,hls_url,duration,status,source,raw,updated_at'
const LIST_CACHE_TTL = Number(process.env.AIANIME_LIST_CACHE_TTL_MS || 3600000)
const EPISODE_CACHE_TTL = Number(process.env.AIANIME_EPISODE_CACHE_TTL_MS || 1800000)
const STALE_CACHE_TTL = Number(process.env.AIANIME_STALE_CACHE_TTL_MS || 21600000)
const RATING_CACHE_TTL = Number(process.env.AIANIME_RATING_CACHE_TTL_MS || 1800000)
const LIST_CACHE_BUCKETS = [80, 720, 1000, 1200]
const listCache = new Map()
const episodeCache = new Map()
const ratingCache = new Map()
const pendingCache = new Map()

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
  if(map.size > 80){
    const first = map.keys().next().value
    if(first) map.delete(first)
  }
  return value
}


function listBucketLimit(limit){
  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 1200)
  return LIST_CACHE_BUCKETS.find(bucket => safeLimit <= bucket) || 1200
}

function listCacheKey(limit){
  return `anime-list:${listBucketLimit(limit)}`
}

function listLimitFromKey(key){
  const match = String(key || '').match(/^anime-list:(\d+)$/)
  return match ? Number(match[1]) : 0
}

function readCachedAnimeList(limit, ttl = LIST_CACHE_TTL){
  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 1200)
  const now = Date.now()
  const candidates = []

  for(const [key,hit] of listCache.entries()){
    const cachedLimit = listLimitFromKey(key)
    if(!cachedLimit || !hit || !Array.isArray(hit.value)) continue
    if(now - hit.at > ttl) continue

    const list = hit.value
    const complete = list.length < cachedLimit
    if(cachedLimit >= safeLimit || complete || list.length >= safeLimit){
      candidates.push({ cachedLimit, list, complete })
    }
  }

  if(!candidates.length) return null
  candidates.sort((a,b) => a.cachedLimit - b.cachedLimit)
  return candidates[0].list.slice(0, safeLimit)
}

function readStaleAnimeList(limit){
  return readCachedAnimeList(limit, STALE_CACHE_TTL)
}


async function getCommunityRatingMap(){
  const cacheKey = 'community-ratings:v112'
  const cached = readCache(ratingCache, cacheKey, RATING_CACHE_TTL)
  if(cached) return cached
  const stale = readStaleCache(ratingCache, cacheKey, STALE_CACHE_TTL)
  if(stale){
    refreshInBackground(cacheKey, async () => writeCache(ratingCache, cacheKey, await readCommunityRatingsFromSupabase()))
    return stale
  }
  return withPending(cacheKey, async () => {
    const cachedAgain = readCache(ratingCache, cacheKey, RATING_CACHE_TTL)
    if(cachedAgain) return cachedAgain
    return writeCache(ratingCache, cacheKey, await readCommunityRatingsFromSupabase())
  })
}

async function readCommunityRatingsFromSupabase(){
  if(!hasSupabase()) return new Map()
  try{
    const res = await supabaseRequest('user_ratings?select=anime_slug,rating&limit=20000', { method:'GET', timeout:5500 })
    if(!res.ok) return new Map()
    const rows = await res.json().catch(() => [])
    if(!Array.isArray(rows) || !rows.length) return new Map()

    const grouped = new Map()
    for(const row of rows){
      const slug = String(row?.anime_slug || '').trim()
      const rating = Number(row?.rating || 0)
      if(!slug || !Number.isFinite(rating) || rating <= 0) continue
      const current = grouped.get(slug) || { sum:0, count:0 }
      current.sum += rating
      current.count += 1
      grouped.set(slug, current)
    }

    const result = new Map()
    for(const [slug, stat] of grouped.entries()){
      const averageFive = stat.count ? stat.sum / stat.count : 0
      const averageTen = averageFive * 2
      result.set(slug, {
        value: averageFive,
        count: stat.count,
        score: averageTen,
        rating: averageTen.toFixed(1).replace('.0', '')
      })
    }
    return result
  }catch(error){
    console.warn('AIanime community rating read failed:', error?.message || error)
    return new Map()
  }
}

async function applyCommunityRatingStats(list){
  if(!Array.isArray(list) || !list.length || !hasSupabase()) return list
  const ratingMap = await getCommunityRatingMap()
  if(!ratingMap?.size) return list
  return list.map(item => {
    const stat = ratingMap.get(item?.slug)
    if(!stat || !stat.count) return item
    return {
      ...item,
      rating: stat.rating,
      score: stat.score,
      siteRating: stat.value,
      siteRatingCount: stat.count
    }
  })
}

function readStaleCache(map, key, ttl = STALE_CACHE_TTL){
  const hit = map.get(key)
  if(!hit) return null
  if(Date.now() - hit.at > ttl){
    map.delete(key)
    return null
  }
  return hit.value
}

function withPending(key, factory){
  const existing = pendingCache.get(key)
  if(existing) return existing
  const promise = Promise.resolve()
    .then(factory)
    .finally(() => pendingCache.delete(key))
  pendingCache.set(key, promise)
  return promise
}

function refreshInBackground(key, factory){
  if(pendingCache.has(key)) return
  const promise = Promise.resolve()
    .then(factory)
    .catch(error => {
      console.warn('AIanime background cache refresh skipped:', error?.message || error)
    })
    .finally(() => pendingCache.delete(key))
  pendingCache.set(key, promise)
}

function isMissingPoster(url){
  return !url || /missing_(original|preview|x160|x96)\.jpg/i.test(url)
}

function isPlaceholderPoster(url){
  const raw = String(url || '').trim().toLowerCase()
  if(!raw) return true
  if(isMissingPoster(raw)) return true
  return /\/posters\/magic|placeholder|no[-_]?poster|default/.test(raw)
}

function isBrokenCatalogSlug(slug){
  const text = String(slug || '').trim().toLowerCase()
  return !text || text === 'undefined' || text === 'null' || text.startsWith('catalog-title-')
}

function hasCyrillicText(value){
  return /[А-Яа-яЁё]/.test(String(value || ''))
}

function isLikelySyntheticBrokenText(item = {}){
  const slug = String(item.slug || '').toLowerCase()
  const title = String(item.title || item.displayTitle || item.titleRu || '').toLowerCase()
  const original = String(item.originalTitle || item.original_title || item.title_orig_kodik || '').toLowerCase()
  const description = String(item.description || item.descriptionRu || '').toLowerCase()

  if(isBrokenCatalogSlug(slug)) return true
  // Такие фразы появились из старых seed/catalog-title заготовок после автодобора и ломают карточки.
  const poisoned = ['стальной алхимик3', 'тетрадь смерти4', 'anime-ova 2022', 'anime-ova 2023']
  if(poisoned.some(x => description.includes(x))) return true
  if(title.includes('mini') && (description.includes('стальной алхимик') || description.includes('тетрадь смерти'))) return true
  if(original.includes('catalog-title')) return true
  return false
}

function hasPublicReadyPoster(item = {}){
  const poster = String(item.poster || item.poster_url || '').trim()
  if(item.hasRealPoster === false) return false
  if(isPlaceholderPoster(poster)) return false
  return true
}

function isPublicListItem(item = {}){
  if(isAnimeRestricted(item)) return false
  if(isLikelySyntheticBrokenText(item)) return false
  const slug = String(item.slug || '').trim()
  if(isBrokenCatalogSlug(slug)) return false
  const title = String(item.title || item.displayTitle || item.titleRu || '').trim()
  if(!title) return false

  // В публичные списки (главная/каталог/подборки) не выпускаем сырые записи.
  // Они могут существовать в Supabase и открываться напрямую по slug, но пока у них
  // нет настоящего постера, карточка выглядит как seed-заглушка и ломает доверие к каталогу.
  if(!hasPublicReadyPoster(item)) return false

  return true
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
      host.endsWith('.shikimori.one') ||
      host === 'shikimori.io' ||
      host.endsWith('.shikimori.io')
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
    // Внешние CDN (например cdn.myanimelist.net) у части пользователей не открываются.
    // Поэтому прод-режим по умолчанию гонит внешние постеры через быстрый кеширующий /api/image.
    // Если понадобится максимум скорости и CDN доступен напрямую — можно поставить Aianime image proxy mode = direct.
    if(imageProxyMode() === 'direct') return raw
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
  // MAL ID не равен Shikimori ID. Не подставляем shikimori_id в malId,
  // иначе внешние рейтинги MAL начинают показывать чужие значения.
  return row?.mal_id ?? row?.malId ?? null
}

function getShikimoriId(row){
  return row?.shikimori_id ?? row?.shikimoriId ?? null
}

function remoteImagesEnabled(){
  return process.env.ENABLE_REMOTE_IMAGES === '1' || process.env.NEXT_PUBLIC_ENABLE_REMOTE_IMAGES === '1'
}

function pickRawPoster(row){
  const candidates = [
    row?.poster,
    row?.image_url,
    row?.image,
    row?.poster_url,
    row?.banner_url,
    row?.raw?.poster_url,
    row?.raw?.image_url,
    row?.raw?.images?.webp?.large_image_url,
    row?.raw?.images?.jpg?.large_image_url,
    row?.raw?.images?.webp?.image_url,
    row?.raw?.images?.jpg?.image_url,
    row?.raw?.data?.images?.webp?.large_image_url,
    row?.raw?.data?.images?.jpg?.large_image_url,
    row?.kodik_raw?.material_data?.poster_url,
    row?.kodik_raw?.material_data?.anime_poster_url,
    Array.isArray(row?.kodik_screenshots) ? row.kodik_screenshots[0] : null,
    Array.isArray(row?.screenshots) ? row.screenshots[0] : null,
  ]
  return candidates.find(value => value && !isPlaceholderPoster(value)) || null
}

function hasUsablePosterSource(value){
  const text = String(value || '').trim()
  if(!text || isPlaceholderPoster(text)) return false
  if(/^https?:\/\//i.test(text)) return isAllowedRemoteImage(text)
  if(text.startsWith('/api/image')) return /[?&]url=/i.test(text) && !/%2fposters%2fmagic/i.test(text.toLowerCase())
  if(text.startsWith('/images/')) return true
  // Локальные /posters/* — это наши декоративные fallback-картинки,
  // а не настоящий постер конкретного тайтла. Не считаем их готовым контентом.
  if(text.startsWith('/posters/')) return false
  return false
}

function jikanPoster(id, fallback){
  if(!remoteImagesEnabled()) return fallback || null
  const numericId = Number(id)
  if(!Number.isFinite(numericId) || numericId <= 0) return fallback || null
  const safeFallback = fallback && String(fallback).startsWith('/') ? fallback : '/posters/magic2.svg'
  return `/api/poster?id=${numericId}&fallback=${encodeURIComponent(safeFallback)}`
}

function cleanGenres(genres){
  return translateGenres(genres)
}

export function normalizeSeedForDb(item){
  return {
    shikimori_id: item.shikimoriId || item.shikimori_id || null,
    slug: item.slug,
    title: item.title,
    original_title: item.originalTitle || item.original_title || null,
    description: item.description || null,
    description_ru: item.description_ru || makeRussianDescription(item),
    status: item.status || null,
    kind: item.kind || null,
    year: item.year || null,
    episodes: item.episodes || 0,
    rating: Number(item.score || item.rating || 0) || null,
    poster_url: item.poster || item.poster_url || null,
    banner_url: item.banner || item.banner_url || item.poster || null,
    genres: translateGenres(item.genres),
    studio: item.studio || null,
    provider: item.provider || 'seed',
    raw: item,
    updated_at: new Date().toISOString(),
  }
}

export function mapDbAnime(row, index = 0){
  const fallbackPoster = localPoster(index)
  const malId = getMalId(row)
  const shikimoriId = getShikimoriId(row)
  const rawPoster = pickRawPoster(row)
  const posterSource = isPlaceholderPoster(row.poster_url) ? rawPoster : (row.poster_url || rawPoster)
  const posterFromDb = proxyImage(posterSource, fallbackPoster)
  const remotePoster = posterFromDb ? null : jikanPoster(malId, fallbackPoster)
  const kodikShotSource = Array.isArray(row.kodik_screenshots) && row.kodik_screenshots[0] ? row.kodik_screenshots[0] : null
  const kodikShot = kodikShotSource ? proxyImage(kodikShotSource, fallbackPoster) : null
  const poster = posterFromDb || remotePoster || kodikShot || fallbackPoster
  const rawBanner = isPlaceholderPoster(row.banner_url) ? (posterSource || rawPoster) : row.banner_url
  const banner = proxyImage(rawBanner, poster) || poster
  const hasRealPoster = Boolean(
    hasUsablePosterSource(posterSource) ||
    hasUsablePosterSource(rawPoster) ||
    hasUsablePosterSource(remotePoster) ||
    hasUsablePosterSource(kodikShotSource)
  )
  const sourceScore = Number(row.rating || row.score || 0) || 0
  const score = 0
  const episodes = Number(row.episodes || 0) || 0
  const status = normalizeStatus(row.status)
  const kind = row.kind || 'tv'
  const genres = cleanGenres(row.genres)
  const episodeCount = Math.max(1, Math.min(episodes || 12, 64))

  const title = cleanPublicText(row.title_ru || row.title || row.original_title || 'Без названия') || 'Без названия'
  const originalTitle = cleanPublicText(row.title_orig_kodik || row.original_title || row.title || '')
  const englishTitle = cleanPublicText(row.title || row.original_title || '')
  const restriction = getAnimeRestriction(row)

  return applyAnimeContentOverrides(row, {
    id: row.id || malId || shikimoriId || index + 1,
    malId: malId || null,
    shikimoriId: shikimoriId || null,
    slug: row.slug,
    restriction,
    restricted:Boolean(restriction),
    title,
    displayTitle: title,
    originalTitle,
    englishTitle,
    meta: kind === 'movie' ? 'Фильм' : `${episodes || '?'} серий`,
    status,
    rawStatus:row.status || '',
    kind,
    year: row.year || null,
    // На карточках показываем только реальный рейтинг AIanime из user_ratings.
    // Старый score/rating из внешних источников не выводим как наш рейтинг.
    rating: '—',
    score,
    sourceScore,
    popularity: Number(row.popularity || row.rating || row.score || 0) || sourceScore,
    episodes,
    genres: genres.length ? genres : ['Аниме'],
    poster,
    banner,
    hasRealPoster,
    progress: 0,
    studio: row.studio || '—',
    titleRu: cleanPublicText(row.title_ru) || null,
    translationTitle: row.translation_title || null,
    translationType: row.translation_type || null,
    quality: row.quality || null,
    kodikId: row.kodik_id || null,
    kodikLink: row.kodik_link || null,
    kodikType: row.kodik_type || null,
    kodikScreenshots: Array.isArray(row.kodik_screenshots) ? row.kodik_screenshots : [],
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    addedAt: row.created_at || row.updated_at || null,
    nextEpisode: status === 'ongoing' ? 'Скоро' : '—',
    description: preferRussianDescription({ ...row, genres, title, original_title: originalTitle }),
    descriptionRu: cleanPublicText(row.description_ru) || makeRussianDescription({ ...row, genres, title, original_title: originalTitle }),
    mood: [],
    // Не отправляем массив из десятков серий в каждую карточку каталога —
    // это заметно облегчает payload между страницами. Детальная страница
    // всё равно читает реальные серии из anime_episodes.
    episodesList: []
  })
}


function applyAnimeContentOverrides(row, mapped){
  const slug = String(row?.slug || mapped?.slug || '')

  // Этот slug был испорчен смешением MAL/Jikan 1997 Pokémon и Kodik-русского названия
  // от мини-сериала 2023 Pocket Monsters: Mezase Pokémon Master.
  // Пока база не вычищена полностью, принудительно держим карточку как тот тайтл,
  // который видит пользователь: 2023 год и 11 серий, а не 276 серий оригинального сезона.
  if(slug === '527-pokemon'){
    const titleRu = 'Покемон: Стремление стать мастером покемонов'
    const originalTitle = 'Pocket Monsters: Mezase Pokémon Master'
    const descriptionRu = '«Покемон: Стремление стать мастером покемонов» — мини-сериал 2023 года на 11 серий. Это отдельный финальный блок путешествия Эша и Пикачу, поэтому он не должен смешиваться с оригинальным сериалом 1997 года и другими сезонами Pokémon.'

    return {
      ...mapped,
      title:titleRu,
      displayTitle:titleRu,
      titleRu,
      originalTitle,
      englishTitle:'Pocket Monsters: Mezase Pokemon Master',
      year:2023,
      episodes:11,
      meta:'11 серий',
      status:'completed',
      kind:'tv',
      description:descriptionRu,
      descriptionRu,
    }
  }

  return mapped
}


function seedFallbackList(safeLimit, reason = 'unknown'){
  const fallback = seedAnime.map(mapSeedAnime).slice(0, safeLimit)
  if(isSeedCatalogFallbackAllowed()) return fallback

  console.error(`AIanime production catalog guard blocked seed fallback: ${reason}. Seed count=${seedAnime.length}, min=${minProductionCatalogSize()}.`)
  return []
}

function assertSafeProductionCatalog(rows, requestedLimit, label = 'anime'){
  const reason = catalogGuardReason(Array.isArray(rows) ? rows.length : 0, requestedLimit)
  if(reason){
    throw new Error(`${label}: ${reason}`)
  }
  return rows
}

function mapSeedAnime(item){
  const fallbackPoster = item.poster || '/posters/magic2.svg'
  return {
    ...item,
    displayTitle: item.title,
    poster: fallbackPoster,
    banner: item.banner || fallbackPoster,
    status: normalizeStatus(item.status),
    score: 0,
    rating: '—',
    sourceScore: Number(item.score || item.rating || 0) || 0,
    popularity: Number(item.score || item.rating || 0) || 0,
    createdAt: item.createdAt || item.created_at || null,
    updatedAt: item.updatedAt || item.updated_at || null,
    addedAt: item.addedAt || item.createdAt || item.created_at || null,
    genres: translateGenres(item.genres),
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

  // Быстрый путь: берём только поля, которые реально нужны UI.
  // Если на старой схеме нет одной из колонок — мягко падаем на select=*,
  // чтобы сайт не откатывался в seed-каталог.
  const queryFast = `${table}?select=${encodeURIComponent(ANIME_SELECT)}&order=rating.desc.nullslast&limit=${safeLimit}`
  const resFast = await supabaseRequest(queryFast, { method: 'GET', timeout: 9000 })
  if(resFast.ok) return parseSupabaseRows(resFast, table)

  const queryAll = `${table}?select=*&order=rating.desc.nullslast&limit=${safeLimit}`
  const resAll = await supabaseRequest(queryAll, { method: 'GET', timeout: 12000 })
  return parseSupabaseRows(resAll, table)
}

async function readAnimeBySlug(table, slug){
  const safeSlug = encodeURIComponent(String(slug || '').trim())
  if(!safeSlug) return null
  const queryFast = `${table}?select=${encodeURIComponent(ANIME_DETAIL_SELECT)}&slug=eq.${safeSlug}&limit=1`
  const resFast = await supabaseRequest(queryFast, { method: 'GET', timeout: 8000 })
  if(resFast.ok){
    const rows = await parseSupabaseRows(resFast, `${table} slug`)
    return rows[0] || null
  }

  const query = `${table}?select=*&slug=eq.${safeSlug}&limit=1`
  const res = await supabaseRequest(query, { method: 'GET', timeout: 9000 })
  const rows = await parseSupabaseRows(res, `${table} slug`)
  return rows[0] || null
}

export async function getAnimeList({ limit = 300 } = {}){
  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 1200)
  if(!hasSupabase()) return filterRestrictedAnime(seedFallbackList(safeLimit, 'supabase runtime disabled or env missing')).slice(0, safeLimit)

  // Не держим отдельный Supabase-запрос под каждый limit: 220/720/1000/1200.
  // Это была главная причина лишнего egress. Берём общий bucket и режем массив в памяти.
  const bucketLimit = listBucketLimit(safeLimit)
  const cacheKey = listCacheKey(safeLimit)

  const cached = readCachedAnimeList(safeLimit, LIST_CACHE_TTL)
  if(cached) return filterRestrictedAnime(cached).slice(0, safeLimit)

  const stale = readStaleAnimeList(safeLimit)
  if(stale){
    refreshInBackground(cacheKey, async () => {
      let rows = []
      try{ rows = await readSupabaseTable('anime', bucketLimit) }
      catch(firstError){ rows = await readSupabaseTable('anime_titles', bucketLimit) }
      if(rows.length){
        assertSafeProductionCatalog(rows, bucketLimit, 'anime background refresh')
        writeCache(listCache, cacheKey, await applyCommunityRatingStats(rows.map(mapDbAnime).filter(isPublicListItem)))
      }
    })
    return filterRestrictedAnime(stale).slice(0, safeLimit)
  }

  return withPending(cacheKey, async () => {
    const cachedAgain = readCachedAnimeList(safeLimit, LIST_CACHE_TTL)
    if(cachedAgain) return cachedAgain
    try{
      let rows = []
      try{
        rows = await readSupabaseTable('anime', bucketLimit)
      }catch(firstError){
        rows = await readSupabaseTable('anime_titles', bucketLimit)
      }
      if(!rows.length) return filterRestrictedAnime(seedFallbackList(safeLimit, 'supabase returned empty anime rows')).slice(0, safeLimit)
      assertSafeProductionCatalog(rows, bucketLimit, 'anime list')
      const mapped = writeCache(listCache, cacheKey, await applyCommunityRatingStats(rows.map(mapDbAnime).filter(isPublicListItem)))
      return mapped.slice(0, safeLimit)
    }catch(error){
      console.warn('Supabase anime read failed:', error?.message || error)
      return filterRestrictedAnime(seedFallbackList(safeLimit, error?.message || 'supabase read failed')).slice(0, safeLimit)
    }
  })
}


export async function getAnimeBySlugFromRepo(slug){
  const normalizedSlug = String(slug || '').trim()
  if(!normalizedSlug) return null
  if(isBrokenCatalogSlug(normalizedSlug)) return null

  if(hasSupabase()){
    const cacheKey = `anime-slug:${normalizedSlug}`
    const cached = readCache(listCache, cacheKey, LIST_CACHE_TTL)
    if(cached) return cached
    const stale = readStaleCache(listCache, cacheKey)
    if(stale) return stale

    const rowResult = await withPending(cacheKey, async () => {
      const cachedAgain = readCache(listCache, cacheKey, LIST_CACHE_TTL)
      if(cachedAgain) return cachedAgain
      try{
        let row = null
        try{
          row = await readAnimeBySlug('anime', normalizedSlug)
        }catch(firstError){
          row = await readAnimeBySlug('anime_titles', normalizedSlug)
        }
        if(row){
          const [mapped] = await applyCommunityRatingStats([mapDbAnime(row, 0)])
          return writeCache(listCache, cacheKey, mapped)
        }
      }catch(error){
        console.warn('Supabase anime slug read failed:', error?.message || error)
      }
      return null
    })
    if(rowResult) return rowResult
  }

  const list = await getAnimeList({ limit: 1000 })
  return list.find(item => item.slug === normalizedSlug) || null
}


export function getSimilarFromList(item, list, limit = 6){
  const genres = Array.isArray(item.genres) ? item.genres : []
  const scored = list
    .filter(a => a.slug !== item.slug && !isAnimeRestricted(a))
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
  const safeList = filterRestrictedAnime(Array.isArray(list) ? list : [])
  const text = String(query || '').trim()
  if(!text) return safeList.slice(0, limit)
  return filterAndSortAnime(safeList, text, {}, 'relevant').slice(0, limit)
}

export function invalidateAnimeRepositoryCache(slug = ''){
  const normalizedSlug = String(slug || '').trim()
  for(const key of Array.from(listCache.keys())){
    if(key.startsWith('anime-list:') || (normalizedSlug && key === `anime-slug:${normalizedSlug}`)) listCache.delete(key)
  }
  if(normalizedSlug) episodeCache.delete(`episodes:${normalizedSlug}`)
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
    raw: row.raw || null,
    quality: row.raw?.quality || row.raw?.quality_label || null,
    translationType: row.raw?.translation_type || null,
    translationId: row.raw?.translation_id || null,
    seasonNumber: row.raw?.season_number || null,
    updatedAt: row.updated_at || null,
  }
}

export async function getEpisodesBySlug(slug, fallbackCount = 12){
  const normalizedSlug = String(slug || '').trim()
  if(!normalizedSlug) return []

  if(hasSupabase()){
    const cacheKey = `episodes:${normalizedSlug}`
    const cached = readCache(episodeCache, cacheKey, EPISODE_CACHE_TTL)
    if(cached) return cached
    const stale = readStaleCache(episodeCache, cacheKey)
    if(stale){
      refreshInBackground(cacheKey, async () => {
        const rows = await readEpisodeRowsFromSupabase(normalizedSlug)
        if(rows.length) writeCache(episodeCache, cacheKey, rows.map(mapDbEpisode))
      })
      return stale
    }

    return withPending(cacheKey, async () => {
      const cachedAgain = readCache(episodeCache, cacheKey, EPISODE_CACHE_TTL)
      if(cachedAgain) return cachedAgain
      try{
        const rows = await readEpisodeRowsFromSupabase(normalizedSlug)
        if(rows.length) return writeCache(episodeCache, cacheKey, rows.map(mapDbEpisode))
      }catch(error){
        console.warn('Supabase episodes read failed:', error?.message || error)
      }
      return buildFallbackEpisodes(normalizedSlug, fallbackCount)
    })
  }

  return buildFallbackEpisodes(normalizedSlug, fallbackCount)
}

async function readEpisodeRowsFromSupabase(normalizedSlug){
  // Важно: у тайтла может быть много строк: озвучки × серии.
  // Читаем пакетами, но кешируем и дедуплицируем запросы, чтобы повторные переходы не зависали.
  const pageSize = 1000
  const maxRows = 12000
  const allRows = []

  for(let offset = 0; offset < maxRows; offset += pageSize){
    const query = `anime_episodes?select=${EPISODE_SELECT}&anime_slug=eq.${encodeURIComponent(normalizedSlug)}&order=episode_number.asc&order=voice.asc&limit=${pageSize}&offset=${offset}`
    const res = await supabaseRequest(query, { method: 'GET', timeout: 9000 })
    if(!res.ok){
      if(offset === 0) console.warn('Supabase episodes read failed:', res.status)
      break
    }

    const rows = await res.json().catch(() => [])
    if(!Array.isArray(rows) || !rows.length) break

    allRows.push(...rows)
    if(rows.length < pageSize) break
  }

  return allRows
}

function buildFallbackEpisodes(normalizedSlug, fallbackCount = 12){
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
