import { getAnimeList } from '@/lib/animeRepository'

function slugify(text){
  return String(text || 'unknown').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,'-').replace(/^-|-$/g,'') || 'unknown'
}

export default async function sitemap(){
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const anime = await getAnimeList({ limit: 1000 })
  const now = new Date()

  const staticPaths = [
    '',
    '/catalog',
    '/schedule',
    '/ai',
    '/ai/quiz',
    '/collections',
    '/season',
    '/genres',
    '/top',
    '/top/rating',
    '/top/popular',
    '/top/new',
    '/top/episodes',
    '/studios',
  ]

  const staticPages = staticPaths.map(path => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: path === '' ? 1 : 0.82,
  }))

  const animePages = anime.map(item => ({
    url: `${base}/anime/${item.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.72,
  }))

  const genres = [...new Set(anime.flatMap(a => a.genres || []))]
  const genrePages = genres.map(genre => ({
    url: `${base}/genre/${slugify(genre)}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.62,
  }))

  const studios = [...new Set(anime.map(a => a.studio && a.studio !== '—' ? a.studio : 'Неизвестная студия'))]
  const studioPages = studios.map(studio => ({
    url: `${base}/studio/${slugify(studio)}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.58,
  }))

  return [...staticPages, ...animePages, ...genrePages, ...studioPages]
}
