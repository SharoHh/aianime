const BASE = 'https://kodikapi.com'

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
  const hay = [material?.title, material?.title_orig, material?.other_title]
    .map(x => String(x || '').toLowerCase())
    .join(' | ')
  const titles = [anime?.title, anime?.original_title, anime?.title_ru]
    .map(x => String(x || '').toLowerCase().trim())
    .filter(Boolean)

  let score = 0
  for(const title of titles){
    if(!title) continue
    if(hay === title) score += 40
    if(hay.includes(title)) score += 24
    for(const token of title.split(/[^a-zа-яё0-9]+/i).filter(t => t.length > 3)){
      if(hay.includes(token)) score += 3
    }
  }

  const year = Number(anime?.year || 0)
  if(year && Number(material?.year) === year) score += 12
  if(material?.type && String(material.type).includes('anime')) score += 8
  if(material?.translation?.type === 'voice') score += 4

  return score
}

function chooseBestResult(results, anime){
  const list = Array.isArray(results) ? results : []
  if(!list.length) return null
  return list
    .map(item => ({ item, score: scoreMatch(item, anime) }))
    .sort((a,b) => b.score - a.score)[0]?.item || list[0]
}

export async function searchKodikMaterial({ anime = {}, title = '', shikimoriId = null, limit = 5 } = {}){
  const queryTitle = clean(title || anime.title_ru || anime.original_title || anime.title)
  const params = requestParams({ title: queryTitle, shikimoriId, limit, withMaterialData: true })
  const payload = await fetchJsonWithTimeout(`${BASE}/search?${params.toString()}`, { timeout: 11000, retries: 1 })
  const results = Array.isArray(payload?.results) ? payload.results : []
  return chooseBestResult(results, anime)
}

export async function enrichAnimeWithKodik(anime, { limit = 5 } = {}){
  const candidates = [
    anime?.title_ru,
    anime?.original_title,
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
    kodik_updated_at: clean(material.updated_at) || new Date().toISOString(),
    kodik_raw: material,
    updated_at: new Date().toISOString()
  }
}
