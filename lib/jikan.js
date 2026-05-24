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
    status: normalizeStatus(full.status || item?.status),
    kind: normalizeKind(full.type || item?.type),
    year: yearFromItem(full) || yearFromItem(item),
    episodes,
    rating: score,
    poster_url: pickPoster(full) || pickPoster(item),
    banner_url: pickBanner(full) || pickBanner(item),
    genres: getGenres(full).length ? getGenres(full) : getGenres(item),
    studio: getStudio(full) || getStudio(item),
    provider: 'jikan',
    raw: full
  }
}
