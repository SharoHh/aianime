// AIanime v146: XML sitemap helpers with stable lastmod dates and split sitemap files.
import { encodeSlug, slugifyRu } from '@/lib/routeSlugs'
import { SITE_URL } from '@/lib/seo'

export const SITEMAP_CHUNK_SIZE = 500
export const SITEMAP_REVALIDATE_SECONDS = 3600

export const PUBLIC_STATIC_SITEMAP_ROUTES = [
  { path:'/', priority:1, changefreq:'daily' },
  { path:'/catalog', priority:.92, changefreq:'daily' },
  { path:'/schedule', priority:.88, changefreq:'hourly' },
  { path:'/collections', priority:.84, changefreq:'weekly' },
  { path:'/genres', priority:.8, changefreq:'weekly' },
  { path:'/top', priority:.78, changefreq:'daily' },
  { path:'/top/rating', priority:.76, changefreq:'daily' },
  { path:'/top/popular', priority:.76, changefreq:'daily' },
  { path:'/top/new', priority:.74, changefreq:'daily' },
  { path:'/top/episodes', priority:.7, changefreq:'weekly' },
  { path:'/season', priority:.72, changefreq:'daily' },
  { path:'/anime-2026', priority:.72, changefreq:'daily' },
  { path:'/anime-2025', priority:.68, changefreq:'weekly' },
  { path:'/anime-2024', priority:.64, changefreq:'weekly' },
  { path:'/anime-2023', priority:.6, changefreq:'weekly' },
  { path:'/studios', priority:.68, changefreq:'weekly' },
  { path:'/ai', priority:.6, changefreq:'weekly' },
]

export function canonicalPath(path = '/'){
  const value = String(path || '/').trim()
  if(!value || value === '/') return '/'
  return value.startsWith('/') ? value : `/${value}`
}

export function sitemapAbsoluteUrl(path = '/'){
  if(/^https?:\/\//i.test(String(path || ''))) return String(path)
  return `${SITE_URL}${canonicalPath(path) === '/' ? '' : canonicalPath(path)}`
}

export function sitemapAnimePath(slug){
  return `/anime/${encodeURIComponent(String(slug || '')).replace(/%2F/g, '/')}`
}

export function isPublicAnimeForSitemap(item = {}){
  const slug = String(item?.slug || '').trim()
  if(!slug) return false
  if(slug.startsWith('catalog-title-')) return false
  if(slug.startsWith('#U') || slug.includes('#U')) return false
  return true
}

export function validSitemapDate(value){
  if(!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if(Number.isNaN(date.getTime())) return null
  return date
}

export function itemLastModified(item = {}, fallback = null){
  const candidates = [
    item.updatedAt,
    item.updated_at,
    item.addedAt,
    item.createdAt,
    item.created_at,
  ]
  for(const candidate of candidates){
    const date = validSitemapDate(candidate)
    if(date) return date
  }

  const year = Number(item.year || 0)
  if(Number.isFinite(year) && year >= 1960 && year <= 2100) return new Date(Date.UTC(year, 0, 1))

  return validSitemapDate(fallback) || new Date(Date.UTC(2026, 0, 1))
}

export function latestLastModified(items = [], fallback = null){
  let latest = validSitemapDate(fallback) || new Date(Date.UTC(2026, 0, 1))
  for(const item of Array.isArray(items) ? items : []){
    const date = itemLastModified(item, fallback)
    if(date.getTime() > latest.getTime()) latest = date
  }
  return latest
}

export function toSitemapLastMod(value){
  const date = validSitemapDate(value) || new Date(Date.UTC(2026, 0, 1))
  return date.toISOString()
}

export function xmlEscape(value){
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function xmlResponse(xml, revalidate = SITEMAP_REVALIDATE_SECONDS){
  return new Response(xml, {
    headers:{
      'Content-Type':'application/xml; charset=utf-8',
      'Cache-Control':`public, max-age=0, s-maxage=${Number(revalidate) || SITEMAP_REVALIDATE_SECONDS}, stale-while-revalidate=86400`
    }
  })
}

export function buildSitemapUrlset(entries = []){
  const urls = entries
    .filter(entry => entry?.loc || entry?.url)
    .map(entry => {
      const loc = xmlEscape(entry.loc || entry.url)
      const lastmod = entry.lastmod || entry.lastModified ? `<lastmod>${xmlEscape(toSitemapLastMod(entry.lastmod || entry.lastModified))}</lastmod>` : ''
      const changefreq = entry.changefreq || entry.changeFrequency ? `<changefreq>${xmlEscape(entry.changefreq || entry.changeFrequency)}</changefreq>` : ''
      const priority = Number.isFinite(Number(entry.priority)) ? `<priority>${Number(entry.priority).toFixed(2).replace(/0+$/,'').replace(/\.$/,'')}</priority>` : ''
      return `<url><loc>${loc}</loc>${lastmod}${changefreq}${priority}</url>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`
}

export function buildSitemapIndex(entries = []){
  const sitemaps = entries
    .filter(entry => entry?.loc || entry?.url)
    .map(entry => `<sitemap><loc>${xmlEscape(entry.loc || entry.url)}</loc><lastmod>${xmlEscape(toSitemapLastMod(entry.lastmod || entry.lastModified))}</lastmod></sitemap>`)
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemaps}</sitemapindex>`
}

export function uniqueGenreMap(items = []){
  const map = new Map()
  for(const item of Array.isArray(items) ? items : []){
    for(const raw of item?.genres || []){
      const title = String(raw || '').trim()
      const slug = slugifyRu(title)
      if(!title || !slug) continue
      const current = map.get(slug) || { title, slug, items:[] }
      current.items.push(item)
      map.set(slug, current)
    }
  }
  return map
}

export function uniqueStudioMap(items = []){
  const map = new Map()
  for(const item of Array.isArray(items) ? items : []){
    const title = item?.studio && item.studio !== '—' ? String(item.studio).trim() : ''
    if(!title) continue
    const slug = slugifyRu(title)
    if(!slug) continue
    const current = map.get(slug) || { title, slug, items:[] }
    current.items.push(item)
    map.set(slug, current)
  }
  return map
}

export function buildStaticSitemapEntries(anime = []){
  const latest = latestLastModified(anime)
  return PUBLIC_STATIC_SITEMAP_ROUTES.map(route => ({
    loc:sitemapAbsoluteUrl(route.path),
    lastmod:latest,
    changefreq:route.changefreq,
    priority:route.priority
  }))
}

export function buildAnimeSitemapEntries(anime = [], chunkIndex = 0){
  const start = Math.max(0, Number(chunkIndex) || 0) * SITEMAP_CHUNK_SIZE
  return (Array.isArray(anime) ? anime : [])
    .filter(isPublicAnimeForSitemap)
    .slice(start, start + SITEMAP_CHUNK_SIZE)
    .map(item => ({
      loc:sitemapAbsoluteUrl(sitemapAnimePath(item.slug)),
      lastmod:itemLastModified(item),
      changefreq:item.status === 'ongoing' ? 'daily' : 'weekly',
      priority:item.status === 'ongoing' ? .82 : .74,
    }))
}

export function buildGenreSitemapEntries(anime = []){
  return Array.from(uniqueGenreMap(anime).values())
    .sort((a,b) => b.items.length - a.items.length || a.title.localeCompare(b.title, 'ru'))
    .filter(group => group.items.length > 0)
    .map(group => ({
      loc:sitemapAbsoluteUrl(`/genre/${encodeSlug(group.title)}`),
      lastmod:latestLastModified(group.items),
      changefreq:'weekly',
      priority:.64,
    }))
}

export function buildStudioSitemapEntries(anime = []){
  return Array.from(uniqueStudioMap(anime).values())
    .sort((a,b) => b.items.length - a.items.length || a.title.localeCompare(b.title, 'ru'))
    .filter(group => group.items.length > 0)
    .map(group => ({
      loc:sitemapAbsoluteUrl(`/studio/${encodeSlug(group.title)}`),
      lastmod:latestLastModified(group.items),
      changefreq:'weekly',
      priority:.58,
    }))
}
