const BASE = 'https://kodik-api.com'

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getKodikToken(){
  return process.env.KODIK_TOKEN || process.env.NEXT_PUBLIC_KODIK_TOKEN || ''
}

export function hasKodik(){
  return Boolean(getKodikToken())
}

function clean(value){
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text || null
}

function asNumber(value){
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeTitle(value){
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/&/g, ' and ')
    .replace(/\bseason\b/g, ' season ')
    .replace(/\bpart\b/g, ' part ')
    .replace(/\btv\b/g, ' tv ')
    .replace(/[\[\]{}()]/g, ' ')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleTokens(value){
  return normalizeTitle(value).split(' ').filter(token => token.length > 2)
}

function seasonMarkers(value){
  const text = normalizeTitle(value)
  const markers = []
  const season = text.match(/(?:season|сезон|тв)\s*(\d+)/i)
  const part = text.match(/(?:part|часть)\s*(\d+)/i)
  const standalone = text.match(/(?:^|\s)(\d+)(?:\s|$)/)
  if(season) markers.push(`s${season[1]}`)
  if(part) markers.push(`p${part[1]}`)
  if(standalone) markers.push(`n${standalone[1]}`)
  if(/\bzero\b|\b0\b/.test(text)) markers.push('zero')
  if(/final|финал/.test(text)) markers.push('final')
  return markers
}

function markerPenalty(materialTitles, animeTitles){
  const animeText = normalizeTitle(animeTitles.join(' '))
  const materialText = normalizeTitle(materialTitles.join(' '))
  let penalty = 0

  // Частый плохой матч: Steins;Gate -> Steins;Gate 0.
  if(!/\b0\b|zero|ноль/.test(animeText) && (/\b0\b|zero|ноль/.test(materialText))) penalty -= 30

  const animeMarkers = new Set(seasonMarkers(animeText))
  const materialMarkers = new Set(seasonMarkers(materialText))
  for(const marker of materialMarkers){
    if((marker.startsWith('s') || marker.startsWith('p') || marker === 'zero') && animeMarkers.size && !animeMarkers.has(marker)) penalty -= 12
  }
  return penalty
}

function similarityScore(a, b){
  const left = new Set(titleTokens(a))
  const right = new Set(titleTokens(b))
  if(!left.size || !right.size) return 0
  let inter = 0
  for(const token of left) if(right.has(token)) inter += 1
  return inter / Math.max(left.size, right.size)
}

function normalizeScreenshots(value){
  if(!Array.isArray(value)) return []
  return value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 8)
}

function bestTranslation(material){
  const tr = material?.translation || null
  if(!tr || typeof tr !== 'object') return { title:null, type:null, id:null }
  return {
    title: clean(tr.title),
    type: clean(tr.type),
    id: asNumber(tr.id)
  }
}

function requestParams(params = {}){
  const token = getKodikToken()
  if(!token) throw new Error('KODIK_TOKEN is not configured')

  const search = new URLSearchParams()
  search.set('token', token)
  search.set('limit', String(Math.min(Math.max(Number(params.limit) || 1, 1), 100)))
  search.set('with_material_data', params.withMaterialData === false ? 'false' : 'true')

  // Берём только anime-сущности. Kodik различает anime/anime-serial.
  search.set('types', params.types || 'anime,anime-serial')

  if(params.title) search.set('title', String(params.title))
  if(params.shikimoriId) search.set('shikimori_id', String(params.shikimoriId))
  if(params.year) search.set('year', String(params.year))
  if(params.translationId) search.set('translation_id', String(params.translationId))
  if(params.withSeasons) search.set('with_seasons', 'true')
  if(params.withEpisodes) search.set('with_episodes', 'true')
  if(params.withEpisodesData) search.set('with_episodes_data', 'true')
  if(params.withPageLinks) search.set('with_page_links', 'true')
  if(params.episode) search.set('episode', String(params.episode))
  if(params.season) search.set('season', String(params.season))

  return search
}

async function fetchJsonWithTimeout(url, { timeout = 10000, retries = 1 } = {}){
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
          'User-Agent': 'Aianime/1.0 Kodik metadata sync'
        }
      })

      if((res.status === 429 || res.status >= 500) && attempt < retries){
        await sleep(1200 + attempt * 900)
        continue
      }

      if(!res.ok){
        const text = await res.text().catch(() => '')
        throw new Error(`Kodik ${res.status}: ${text.slice(0, 180)}`)
      }

      return await res.json()
    }catch(error){
      lastError = error
      if(attempt < retries) await sleep(800 + attempt * 700)
    }finally{
      clearTimeout(timer)
    }
  }

  throw lastError || new Error('Kodik request failed')
}

function scoreMatch(material, anime){
  const materialTitles = [material?.title, material?.title_orig, material?.other_title]
    .map(clean)
    .filter(Boolean)
  const animeTitles = [anime?.original_title, anime?.title_ru, anime?.title]
    .map(clean)
    .filter(Boolean)

  let score = 0
  for(const animeTitle of animeTitles){
    const animeNorm = normalizeTitle(animeTitle)
    if(!animeNorm) continue

    for(const materialTitle of materialTitles){
      const materialNorm = normalizeTitle(materialTitle)
      if(!materialNorm) continue
      if(materialNorm === animeNorm) score += 80
      else if(materialNorm.includes(animeNorm) || animeNorm.includes(materialNorm)) score += 34
      score += Math.round(similarityScore(materialTitle, animeTitle) * 28)
    }
  }

  const year = Number(anime?.year || 0)
  const materialYear = Number(material?.year || material?.material_data?.year || 0)
  if(year && materialYear){
    const diff = Math.abs(year - materialYear)
    if(diff === 0) score += 28
    else if(diff === 1) score += 8
    else if(diff <= 3) score -= 16
    else score -= 36
  }

  score += markerPenalty(materialTitles, animeTitles)

  if(material?.type && String(material.type).includes('anime')) score += 8
  if(material?.translation?.type === 'voice') score += 4
  if(material?.blocked_countries?.length) score -= 5
  if(material?.camrip) score -= 10

  return score
}

function chooseBestResult(results, anime, { minScore = 24 } = {}){
  const list = Array.isArray(results) ? results : []
  if(!list.length) return null
  const ranked = list
    .map(item => ({ item, score: scoreMatch(item, anime) }))
    .sort((a,b) => b.score - a.score)
  const best = ranked[0]
  if(!best || best.score < minScore) return null
  best.item.__aianime_match_score = best.score
  return best.item
}

export async function searchKodikMaterial({ anime = {}, title = '', shikimoriId = null, limit = 5 } = {}){
  const queryTitle = clean(title || anime.title_ru || anime.original_title || anime.title)
  const year = asNumber(anime.year)
  const attempts = []

  if(queryTitle && year) attempts.push({ title: queryTitle, year })
  if(queryTitle) attempts.push({ title: queryTitle })

  // shikimoriId используем только если он явно похож на Shikimori id, а не на MAL id из legacy-схемы.
  // В текущей базе поле shikimori_id часто хранит MAL id, поэтому не делаем его главным ключом.
  if(shikimoriId && !queryTitle) attempts.push({ shikimoriId })

  let lastPayload = null
  for(const attempt of attempts){
    const params = requestParams({ ...attempt, limit, withMaterialData: true })
    const payload = await fetchJsonWithTimeout(`${BASE}/search?${params.toString()}`, { timeout: 11000, retries: 1 })
    lastPayload = payload
    const results = Array.isArray(payload?.results) ? payload.results : []
    const best = chooseBestResult(results, anime)
    if(best) return best
  }

  const results = Array.isArray(lastPayload?.results) ? lastPayload.results : []
  return chooseBestResult(results, anime, { minScore: 34 })
}


export async function searchKodikMaterialsForAnime(anime, {
  limit = 30,
  withEpisodes = true,
  withEpisodesData = false,
  minScore = 22
} = {}){
  const candidates = [
    anime?.original_title,
    anime?.title_ru,
    anime?.title,
  ].map(clean).filter(Boolean)

  const seen = new Map()
  let lastError = null

  for(const title of [...new Set(candidates)]){
    try{
      const params = requestParams({
        anime,
        title,
        limit,
        withMaterialData: true,
        withSeasons: true,
        withEpisodes,
        withEpisodesData,
      })
      const payload = await fetchJsonWithTimeout(`${BASE}/search?${params.toString()}`, { timeout: 13000, retries: 1 })
      const results = Array.isArray(payload?.results) ? payload.results : []
      for(const item of results){
        const score = scoreMatch(item, anime)
        if(score < minScore) continue
        const key = `${item?.id || item?.link || ''}:${item?.translation?.id || item?.translation?.title || ''}`
        if(!key.trim()) continue
        const existing = seen.get(key)
        if(!existing || score > existing.__aianime_match_score){
          item.__aianime_match_score = score
          seen.set(key, item)
        }
      }
    }catch(error){
      lastError = error
    }
  }

  const rows = Array.from(seen.values()).sort((a,b) => Number(b.__aianime_match_score || 0) - Number(a.__aianime_match_score || 0))
  if(rows.length) return rows
  if(lastError) throw lastError
  return []
}

function getEpisodeCountFromMaterial(material, fallback = 1){
  const values = [
    material?.episodes_count,
    material?.last_episode,
    material?.material_data?.episodes_count,
    material?.material_data?.episodes,
    fallback
  ]
  for(const value of values){
    const number = Number(value)
    if(Number.isFinite(number) && number > 0) return Math.min(Math.max(Math.floor(number), 1), 1200)
  }
  return 1
}

function normalizeSeasonEntries(seasons){
  if(!seasons || typeof seasons !== 'object') return []
  return Object.entries(seasons)
    .map(([seasonNumber, season]) => ({ seasonNumber:Number(seasonNumber) || 1, season:season || {} }))
    .sort((a,b) => a.seasonNumber - b.seasonNumber)
}

function normalizeEpisodeEntries(episodes){
  if(!episodes || typeof episodes !== 'object') return []
  return Object.entries(episodes)
    .map(([episodeNumber, episode]) => ({ episodeNumber:Number(episodeNumber) || 1, episode:episode || {} }))
    .sort((a,b) => a.episodeNumber - b.episodeNumber)
}

export function normalizeKodikEpisodeRows(anime, material, { maxEpisodes = 500 } = {}){
  if(!anime?.slug || !material) return []
  const translation = bestTranslation(material)
  const voice = clean(translation.title) || 'Kodik'
  const translationType = clean(translation.type) || 'voice'
  const provider = 'kodik'
  const quality = clean(material.quality)
  const rows = []
  const seasons = normalizeSeasonEntries(material.seasons)

  for(const { seasonNumber, season } of seasons){
    const episodeEntries = normalizeEpisodeEntries(season?.episodes)
    for(const { episodeNumber, episode } of episodeEntries){
      const embedUrl = normalizeKodikPlayerUrl(episode?.link || episode?.embed_url || episode?.url)
      if(!embedUrl) continue
      rows.push({
        anime_slug: anime.slug,
        episode_number: episodeNumber,
        title: clean(episode?.title) || `Серия ${episodeNumber}`,
        provider,
        voice,
        embed_url: embedUrl,
        hls_url: null,
        status: 'published',
        source: 'kodik-api-episode',
        raw: {
          source: 'kodik-api-episode',
          kodik_id: clean(material.id),
          material_link: normalizeKodikPlayerUrl(material.link),
          season_number: seasonNumber,
          season_link: normalizeKodikPlayerUrl(season?.link),
          episode_link: embedUrl,
          episode_title: clean(episode?.title),
          screenshots: Array.isArray(episode?.screenshots) ? episode.screenshots : [],
          translation_id: translation.id,
          translation_title: voice,
          translation_type: translationType,
          quality,
          match_score: asNumber(material.__aianime_match_score),
        },
        updated_at: new Date().toISOString()
      })
      if(rows.length >= maxEpisodes) return rows
    }
  }

  // Если Kodik не отдал отдельные episode-ссылки, сохраняем только одну базовую ссылку.
  // Фейковые серии с одинаковым iframe больше не создаём.
  const baseUrl = normalizeKodikPlayerUrl(material.link)
  if(baseUrl && !rows.length){
    rows.push({
      anime_slug: anime.slug,
      episode_number: 1,
      title: 'Серия 1',
      provider,
      voice,
      embed_url: baseUrl,
      hls_url: null,
      status: 'published',
      source: 'kodik-api-player',
      raw: {
        source: 'kodik-api-player',
        kodik_id: clean(material.id),
        material_link: baseUrl,
        episodes_count: getEpisodeCountFromMaterial(material, anime?.episodes || 1),
        translation_id: translation.id,
        translation_title: voice,
        translation_type: translationType,
        quality,
        match_score: asNumber(material.__aianime_match_score),
      },
      updated_at: new Date().toISOString()
    })
  }

  return rows
}

export async function resolveKodikEpisodeRowsForAnime(anime, options = {}){
  const materials = await searchKodikMaterialsForAnime(anime, options)
  const rows = []
  const seen = new Set()
  for(const material of materials){
    for(const row of normalizeKodikEpisodeRows(anime, material, options)){
      const key = `${row.anime_slug}:${row.episode_number}:${row.provider}:${row.voice}`
      if(seen.has(key)) continue
      seen.add(key)
      rows.push(row)
    }
  }
  return rows
}

export async function enrichAnimeWithKodik(anime, { limit = 5 } = {}){
  const candidates = [
    anime?.original_title,
    anime?.title_ru,
    anime?.title,
  ].map(clean).filter(Boolean)

  let lastError = null

  for(const title of [...new Set(candidates)]){
    try{
      const material = await searchKodikMaterial({ anime, title, limit })
      if(material) return normalizeKodikMaterial(material, anime)
    }catch(error){
      lastError = error
    }
  }

  if(lastError) throw lastError
  return null
}

export function normalizeKodikPlayerUrl(value){
  const raw = clean(value)
  if(!raw) return null

  let url = raw
  if(url.startsWith('//')) url = `https:${url}`
  if(url.startsWith('/')) url = `https://kodik.info${url}`

  try{
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if(!host.includes('kodik')) return null
    if(parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    parsed.protocol = 'https:'
    return parsed.toString()
  }catch{
    return null
  }
}

export async function resolveKodikPlayerForAnime(anime, { limit = 5 } = {}){
  const patch = await enrichAnimeWithKodik(anime, { limit })
  const embedUrl = normalizeKodikPlayerUrl(patch?.kodik_link)
  if(!patch || !embedUrl) return null

  return {
    provider: 'kodik',
    embedUrl,
    title: patch.title_ru || anime?.title || null,
    kodikId: patch.kodik_id || null,
    translationTitle: patch.translation_title || null,
    translationType: patch.translation_type || null,
    quality: patch.quality || null,
    raw: patch
  }
}

export function normalizeKodikMaterial(material, anime = {}){
  if(!material) return null
  const translation = bestTranslation(material)
  const materialData = material.material_data || {}
  const titleRu = clean(material.title || materialData.title || materialData.title_ru)
  const titleOrig = clean(material.title_orig || materialData.title_original || materialData.title_en)
  const year = asNumber(material.year || materialData.year || anime.year)
  const screenshots = normalizeScreenshots(material.screenshots)

  return {
    kodik_id: clean(material.id),
    kodik_link: clean(material.link),
    kodik_type: clean(material.type),
    title_ru: titleRu,
    title_orig_kodik: titleOrig,
    other_title: clean(material.other_title),
    kodik_year: year,
    kodik_shikimori_id: asNumber(material.shikimori_id),
    translation_id: translation.id,
    translation_title: translation.title,
    translation_type: translation.type,
    quality: clean(material.quality),
    kodik_screenshots: screenshots,
    screenshots,
    kodik_created_at: clean(material.created_at) || null,
    kodik_updated_at: clean(material.updated_at) || new Date().toISOString(),
    camrip: Boolean(material.camrip),
    lgbt: Boolean(material.lgbt),
    blocked_countries: Array.isArray(material.blocked_countries) ? material.blocked_countries : [],
    kodik_match_score: asNumber(material.__aianime_match_score),
    kodik_raw: material,
    updated_at: new Date().toISOString()
  }
}
