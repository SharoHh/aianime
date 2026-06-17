// Shared public-quality guards for anime cards and admin diagnostics.
// A real public card must not use local decorative poster placeholders like /posters/solo.svg.

const LOCAL_POSTER_SVG_RE = /(?:^|\/|%2f)posters(?:\/|%2f)[^?#&"']+\.svg(?:[?#&].*)?$/i
const LOCAL_BANNER_SVG_RE = /(?:^|\/|%2f)banners(?:\/|%2f)[^?#&"']+\.svg(?:[?#&].*)?$/i
const MISSING_RE = /missing_(original|preview|x160|x96)\.jpg/i
const PLACEHOLDER_RE = /placeholder|no[-_]?poster|default|fallback/i

const ALLOWED_IMAGE_HOSTS = [
  'cdn.myanimelist.net',
  'myanimelist.net',
  'i.kodikres.com',
  'kodikres.com',
  'shikimori.one',
  'shikimori.io'
]

export function cleanAnimeQualityText(value){
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function decodeImageValue(value){
  const raw = cleanAnimeQualityText(value)
  if(!raw) return ''
  let current = raw
  for(let i = 0; i < 3; i += 1){
    try{
      const decoded = decodeURIComponent(current)
      if(decoded === current) break
      current = decoded
    }catch{
      break
    }
  }
  return current
}

export function remoteImageAllowed(value){
  try{
    const parsed = new URL(String(value || ''))
    const host = parsed.hostname.toLowerCase()
    return parsed.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.some(allowed => host === allowed || host.endsWith(`.${allowed}`))
  }catch{
    return false
  }
}

function searchParamSource(value){
  const raw = cleanAnimeQualityText(value)
  if(!raw) return ''
  try{
    const parsed = new URL(raw, 'https://aianime.local')
    return parsed.searchParams.get('url') || parsed.searchParams.get('src') || ''
  }catch{
    return ''
  }
}

export function imageSourceFromProxy(value){
  const raw = cleanAnimeQualityText(value)
  const lower = raw.toLowerCase()
  if(!raw) return ''
  if(lower.startsWith('/api/image') || lower.startsWith('/_next/image')){
    return searchParamSource(raw)
  }
  return ''
}

export function isDecorativeLocalPoster(value){
  const raw = cleanAnimeQualityText(value)
  if(!raw) return false
  const decoded = decodeImageValue(raw)
  const proxySource = imageSourceFromProxy(raw)
  const proxyDecoded = decodeImageValue(proxySource)
  const candidates = [raw, decoded, proxySource, proxyDecoded]
    .map(item => cleanAnimeQualityText(item).toLowerCase())
    .filter(Boolean)
  return candidates.some(item => {
    if(LOCAL_POSTER_SVG_RE.test(item) || LOCAL_BANNER_SVG_RE.test(item)) return true
    try{
      const parsed = new URL(item, 'https://aianime.local')
      const path = parsed.pathname.toLowerCase()
      return /^\/posters\/[^?#]+\.svg$/.test(path) || /^\/banners\/[^?#]+\.svg$/.test(path)
    }catch{
      return false
    }
  })
}

export function isPlaceholderPoster(value){
  const raw = cleanAnimeQualityText(value)
  if(!raw) return true
  const decoded = decodeImageValue(raw)
  if(MISSING_RE.test(raw) || MISSING_RE.test(decoded)) return true
  if(isDecorativeLocalPoster(raw)) return true
  if(PLACEHOLDER_RE.test(raw) || PLACEHOLDER_RE.test(decoded)) return true

  const proxySource = imageSourceFromProxy(raw)
  if(proxySource){
    if(isDecorativeLocalPoster(proxySource)) return true
    if(MISSING_RE.test(proxySource) || PLACEHOLDER_RE.test(proxySource)) return true
    return !remoteImageAllowed(proxySource)
  }

  return false
}

export function isUsableAnimePoster(value){
  const raw = cleanAnimeQualityText(value)
  if(!raw || isPlaceholderPoster(raw)) return false

  const proxySource = imageSourceFromProxy(raw)
  if(proxySource) return remoteImageAllowed(proxySource)

  if(raw.startsWith('/api/poster')){
    try{
      const parsed = new URL(raw, 'https://aianime.local')
      const id = Number(parsed.searchParams.get('id') || 0)
      return Number.isFinite(id) && id > 0
    }catch{
      return false
    }
  }

  if(/^https?:\/\//i.test(raw)) return remoteImageAllowed(raw)

  // Local /posters/*.svg are design placeholders, not anime posters.
  return false
}

export function posterCandidatesFromAnimeRow(row = {}){
  return [
    row.poster_url,
    row.banner_url,
    row.poster,
    row.banner,
    row.raw?.images?.webp?.large_image_url,
    row.raw?.images?.jpg?.large_image_url,
    row.raw?.images?.webp?.image_url,
    row.raw?.images?.jpg?.image_url,
    row.raw?.data?.images?.webp?.large_image_url,
    row.raw?.data?.images?.jpg?.large_image_url,
    row.kodik_raw?.material_data?.poster_url,
    row.kodik_raw?.material_data?.anime_poster_url,
    Array.isArray(row.kodik_screenshots) ? row.kodik_screenshots[0] : null,
    Array.isArray(row.screenshots) ? row.screenshots[0] : null,
  ].filter(Boolean)
}

export function pickBestAnimePosterSource(row = {}){
  return posterCandidatesFromAnimeRow(row).find(isUsableAnimePoster) || ''
}

export function hasUsableAnimePoster(rowOrValue = {}){
  if(typeof rowOrValue === 'string') return isUsableAnimePoster(rowOrValue)
  return posterCandidatesFromAnimeRow(rowOrValue).some(isUsableAnimePoster)
}

export function isBrokenCatalogSlug(slug){
  const text = cleanAnimeQualityText(slug).toLowerCase()
  return !text || text === 'undefined' || text === 'null' || text.startsWith('catalog-title-')
}

export function isLikelySeedOrSyntheticText(item = {}){
  const hay = [item.slug, item.title, item.titleRu, item.title_ru, item.displayTitle, item.originalTitle, item.original_title, item.description, item.descriptionRu, item.description_ru]
    .map(value => cleanAnimeQualityText(value).toLowerCase())
    .join(' ')
  if(!hay) return false
  if(hay.includes('catalog-title-')) return true
  const poisoned = ['стальной алхимик3', 'тетрадь смерти4', 'anime-ova 2022', 'anime-ova 2023']
  return poisoned.some(value => hay.includes(value))
}

export function isPublicReadyAnimeItem(item = {}){
  if(isBrokenCatalogSlug(item.slug)) return false
  if(isLikelySeedOrSyntheticText(item)) return false
  const title = cleanAnimeQualityText(item.title || item.displayTitle || item.titleRu || item.title_ru)
  if(!title) return false
  if(item.hasRealPoster === false) return false
  return hasUsableAnimePoster(item) || isUsableAnimePoster(item.poster || item.poster_url || '')
}
