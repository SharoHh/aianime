import { getAnimeList } from '@/lib/animeRepository'
import { encodeSlug } from '@/lib/routeSlugs'
import { SITE_URL } from '@/lib/seo'

export const dynamic = 'force-dynamic'

function slugify(text){
  return encodeSlug(text || 'unknown') || 'unknown'
}

function unique(values){
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]
}

function animeUrl(slug){
  return `${SITE_URL}/anime/${encodeURIComponent(slug).replace(/%2F/g, '/')}`
}

// AIanime v145: complete SEO sitemap for public sections, titles, genres and studios.
export default async function sitemap(){
  const anime = await getAnimeList({ limit: 1200 })
  const now = new Date()

  const staticPages = [
    { path:'', priority:1, changeFrequency:'daily' },
    { path:'/catalog', priority:.92, changeFrequency:'daily' },
    { path:'/schedule', priority:.88, changeFrequency:'hourly' },
    { path:'/collections', priority:.84, changeFrequency:'weekly' },
    { path:'/genres', priority:.8, changeFrequency:'weekly' },
    { path:'/top', priority:.78, changeFrequency:'daily' },
    { path:'/top/rating', priority:.76, changeFrequency:'daily' },
    { path:'/top/popular', priority:.76, changeFrequency:'daily' },
    { path:'/top/new', priority:.74, changeFrequency:'daily' },
    { path:'/top/episodes', priority:.7, changeFrequency:'weekly' },
    { path:'/season', priority:.72, changeFrequency:'weekly' },
    { path:'/studios', priority:.68, changeFrequency:'weekly' },
    { path:'/ai', priority:.6, changeFrequency:'weekly' },
  ].map(page => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }))

  const animePages = anime
    .filter(item => item?.slug && !String(item.slug).startsWith('catalog-title-'))
    .map(item => ({
      url: animeUrl(item.slug),
      lastModified: now,
      changeFrequency: item.status === 'ongoing' ? 'daily' : 'weekly',
      priority: item.status === 'ongoing' ? .82 : .74,
    }))

  const genrePages = unique(anime.flatMap(item => item.genres || [])).map(genre => ({
    url: `${SITE_URL}/genre/${slugify(genre)}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: .64,
  }))

  const studioPages = unique(anime.map(item => item.studio && item.studio !== '—' ? item.studio : '')).map(studio => ({
    url: `${SITE_URL}/studio/${slugify(studio)}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: .58,
  }))

  return [...staticPages, ...animePages, ...genrePages, ...studioPages]
}
