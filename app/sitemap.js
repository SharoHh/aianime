import { getAnimeList } from '@/lib/animeRepository'
import { encodeSlug } from '@/lib/routeSlugs'

export const dynamic = 'force-dynamic'

function siteUrl(){
  return String(process.env.NEXT_PUBLIC_SITE_URL || 'https://aianime.ru').replace(/\/$/, '')
}

function slugify(text){
  return encodeSlug(text || 'unknown') || 'unknown'
}

function unique(values){
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]
}

export default async function sitemap(){
  const base = siteUrl()
  const anime = await getAnimeList({ limit: 1200 })
  const now = new Date()

  const staticPages = [
    { path:'', priority:1, changeFrequency:'daily' },
    { path:'/catalog', priority:.9, changeFrequency:'daily' },
    { path:'/schedule', priority:.86, changeFrequency:'hourly' },
    { path:'/collections', priority:.82, changeFrequency:'weekly' },
    { path:'/genres', priority:.78, changeFrequency:'weekly' },
    { path:'/top', priority:.76, changeFrequency:'daily' },
    { path:'/top/rating', priority:.74, changeFrequency:'daily' },
    { path:'/top/popular', priority:.74, changeFrequency:'daily' },
    { path:'/top/new', priority:.72, changeFrequency:'daily' },
    { path:'/top/episodes', priority:.7, changeFrequency:'weekly' },
    { path:'/season', priority:.7, changeFrequency:'weekly' },
    { path:'/studios', priority:.66, changeFrequency:'weekly' },
    { path:'/ai', priority:.58, changeFrequency:'weekly' },
  ].map(page => ({
    url: `${base}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }))

  const animePages = anime
    .filter(item => item?.slug && !String(item.slug).startsWith('catalog-title-'))
    .map(item => ({
      url: `${base}/anime/${encodeURIComponent(item.slug).replace(/%2F/g, '/')}`,
      lastModified: now,
      changeFrequency: item.status === 'ongoing' ? 'daily' : 'weekly',
      priority: item.status === 'ongoing' ? .78 : .72,
    }))

  const genrePages = unique(anime.flatMap(item => item.genres || [])).map(genre => ({
    url: `${base}/genre/${slugify(genre)}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: .62,
  }))

  const studioPages = unique(anime.map(item => item.studio && item.studio !== '—' ? item.studio : '')).map(studio => ({
    url: `${base}/studio/${slugify(studio)}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: .56,
  }))

  return [...staticPages, ...animePages, ...genrePages, ...studioPages]
}
