// Shared public-quality guards for anime posters.
// IMPORTANT: a proxy URL may contain a decorative fallback in the query string.
// Only the primary image source is evaluated; fallback=... must never mark a real poster as bad.

const LOCAL_POSTER_SVG_RE = /^\/(?:posters|banners)\/[^?#]+\.svg$/i
const MISSING_RE = /missing_(?:original|preview|x160|x96)\.jpg/i
const PLACEHOLDER_PATH_RE = /(?:^|\/)(?:placeholder|no[-_]?poster|default(?:[-_]?poster)?|poster[-_]?missing|blank)(?:[._/-]|$)/i
const RASTER_IMAGE_RE = /\.(?:avif|webp|png|jpe?g)(?:$|[?#])/i

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
  for(let i = 0; i < 4; i += 1){
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

function parsedUrl(value){
  try{
    return new URL(String(value || ''), 'https://aianime.local')
  }catch{
    return null
  }
}

function imagePath(value){
  const source = cleanAnimeQualityText(value)
  if(!source) return ''
  const parsed = parsedUrl(source)
  if(parsed) return decodeImageValue(parsed.pathname).toLowerCase()
  return decodeImageValue(source).split(/[?#]/)[0].toLowerCase()
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

export function imageSourceFromProxy(value){
  const raw = cleanAnimeQualityText(value)
  if(!raw) return ''
  const parsed = parsedUrl(raw)
  if(!parsed) return ''
  const path = parsed.pathname.toLowerCase()
  if(path !== '/api/image' && path !== '/_next/image') return ''
  const nested = parsed.searchParams.get('url') || parsed.searchParams.get('src') || ''
  return decodeImageValue(nested)
}

export function primaryAnimeImageSource(value){
  const raw = cleanAnimeQualityText(value)
  if(!raw) return ''
  return cleanAnimeQualityText(imageSourceFromProxy(raw) || raw)
}


export function versionAnimePosterUrl(value, version = '251'){
  const raw = cleanAnimeQualityText(value)
  if(!raw) return ''
  const parsed = parsedUrl(raw)
  if(!parsed) return raw
  if(parsed.pathname !== '/api/image' && parsed.pathname !== '/api/poster') return raw
  parsed.searchParams.set('pv', String(version || '251'))
  return `${parsed.pathname}${parsed.search}${parsed.hash || ''}`
}

export function isPosterResolverUrl(value){
  const parsed = parsedUrl(value)
  if(!parsed || parsed.pathname !== '/api/poster') return false
  const id = Number(parsed.searchParams.get('id') || 0)
  return Number.isFinite(id) && id > 0
}

export function isDecorativeLocalPoster(value){
  const source = primaryAnimeImageSource(value)
  if(!source || isPosterResolverUrl(source)) return false
  return LOCAL_POSTER_SVG_RE.test(imagePath(source))
}

export function isPlaceholderPoster(value){
  const raw = cleanAnimeQualityText(value)
  if(!raw) return true

  // /api/poster?id=... is a resolver, not a decorative poster itself.
  if(isPosterResolverUrl(raw)) return false

  const source = primaryAnimeImageSource(raw)
  if(!source) return true
  if(MISSING_RE.test(source)) return true

  const path = imagePath(source)
  if(!path) return true
  if(LOCAL_POSTER_SVG_RE.test(path)) return true
  if(PLACEHOLDER_PATH_RE.test(path)) return true

  return false
}

export function isUsableAnimePoster(value){
  const raw = cleanAnimeQualityText(value)
  if(!raw || isPlaceholderPoster(raw)) return false

  const source = primaryAnimeImageSource(raw)
  if(!source) return false

  // Remote image proxies are valid only when their primary url is an allowed image host.
  if(imageSourceFromProxy(raw)) return remoteImageAllowed(source)
  if(/^https?:\/\//i.test(source)) return remoteImageAllowed(source)

  // Local raster assets are allowed, but decorative SVGs are never public anime posters.
  if(source.startsWith('/')) return RASTER_IMAGE_RE.test(source)

  return false
}

export function posterCandidatesFromAnimeRow(row = {}){
  return [
    row.poster,
    row.poster_url,
    row.image_url,
    row.image,
    row.raw?.poster_url,
    row.raw?.image_url,
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
    row.banner,
    row.banner_url,
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

  // Do not trust an old hasRealPoster flag: older builds marked valid proxy URLs as false
  // merely because their query string contained fallback=/posters/*.svg.
  return hasUsableAnimePoster(item) || isUsableAnimePoster(item.poster || item.poster_url || '')
}

export function filterPublicReadyAnimeItems(items = []){
  return (Array.isArray(items) ? items : []).filter(isPublicReadyAnimeItem)
}
