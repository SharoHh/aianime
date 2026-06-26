export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Каталог аниме онлайн — смотреть на русском | AIanime',
  description: 'Большой каталог аниме онлайн на русском: поиск по тайтлам, жанрам, годам, статусу, рейтингу и быстрый переход к просмотру.',
  alternates: { canonical: '/catalog' },
  openGraph: { title: 'Каталог аниме онлайн — смотреть на русском | AIanime', description: 'Большой каталог аниме онлайн на русском: поиск по тайтлам, жанрам, годам, статусу, рейтингу и быстрый переход к просмотру.', url: '/catalog', type: 'website' }
}

import Link from 'next/link'
import { getAnimeList } from '@/lib/animeRepository'
import CatalogClient from './CatalogClient'
import { animeListJsonLd, jsonLd } from '@/lib/seo'
function compactAnimeText(value, limit = 220){
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if(!text) return ''
  if(!limit || text.length <= limit) return text
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`
}

function compactAnimeItem(item = {}, options = {}){
  const descriptionLimit = Number(options.descriptionLimit || 220)
  const genresLimit = Number(options.genresLimit || 8)
  return {
    slug: item.slug || '',
    title: compactAnimeText(item.title || 'Без названия', 96),
    titleRu: compactAnimeText(item.titleRu || item.title_ru || '', 96),
    displayTitle: compactAnimeText(item.displayTitle || item.title || '', 96),
    originalTitle: compactAnimeText(item.originalTitle || item.original_title || '', 120),
    englishTitle: compactAnimeText(item.englishTitle || item.titleEnglish || '', 120),
    studio: compactAnimeText(item.studio || '', 80),
    poster: item.poster || '/posters/magic2.svg',
    banner: item.banner || item.bannerUrl || item.poster || '/posters/magic2.svg',
    hasRealPoster: item.hasRealPoster !== false,
    kodikId: item.kodikId || item.kodik_id || null,
    kodikLink: item.kodikLink || item.kodik_link || null,
    translationTitle: item.translationTitle || item.translation_title || '',
    description: compactAnimeText(item.description || '', descriptionLimit),
    genres: Array.isArray(item.genres) ? item.genres.filter(Boolean).slice(0, genresLimit) : [],
    year: item.year || null,
    meta: compactAnimeText(item.meta || '', 80),
    status: item.status || '',
    kind: item.kind || '',
    episodes: Number(item.episodes || 0) || 0,
    rating: item.rating || '—',
    score: Number(item.score || 0) || 0,
    popularity: Number(item.popularity || 0) || 0,
    siteRatingCount: Number(item.siteRatingCount || 0) || 0,
    livePopularityScore: Number(item.livePopularityScore || 0) || 0,
    livePopularityActions: Number(item.livePopularityActions || 0) || 0,
    livePopularityLabel: item.livePopularityLabel || ''
  }
}

function compactAnimeItems(items = [], limit = 1000, options = {}){
  const safe = Array.isArray(items) ? items : []
  return safe.slice(0, Math.max(1, Number(limit || 1000))).map(item => compactAnimeItem(item, options))
}

function isBrokenCatalogText(item = {}){
  const text = [item.title, item.titleRu, item.displayTitle, item.originalTitle, item.description, item.slug].filter(Boolean).join(' ').toLowerCase()
  return text.includes('catalog-title-')
    || text.includes('стальной алхимик3')
    || text.includes('тетрадь смерти4')
}

function unwrapPosterSource(value){
  const raw = String(value || '').trim()
  if(!raw) return ''
  try{
    const parsed = new URL(raw, 'https://aianime.local')
    if(parsed.pathname === '/api/image' || parsed.pathname === '/_next/image'){
      const nested = parsed.searchParams.get('url')
      if(nested) return decodeURIComponent(nested)
    }
  }catch{}
  return raw
}

function isPlaceholderPoster(url){
  const source = unwrapPosterSource(url)
  if(!source) return true
  let path = source.split(/[?#]/)[0].toLowerCase()
  try{ path = decodeURIComponent(new URL(source, 'https://aianime.local').pathname).toLowerCase() }catch{}
  if(/^\/(?:posters|banners)\/[^/?#]+\.svg$/i.test(path)) return true
  return /(?:^|\/)(?:placeholder|no[-_]?poster|default(?:-poster)?)(?:[._/-]|$)/i.test(path)
}

function isRenderableCatalogItem(item = {}){
  const slug = String(item.slug || '').trim().toLowerCase()
  if(!slug || slug === 'undefined' || slug === 'null' || slug.startsWith('catalog-title-')) return false
  if(isBrokenCatalogText(item)) return false
  const title = String(item.title || item.displayTitle || item.titleRu || '').trim()
  if(!title) return false
  if(item.hasRealPoster === false || isPlaceholderPoster(item.poster || item.poster_url)) return false
  // Не показываем карточки, которые точно ведут в пустоту, являются старыми seed-заглушками
  // или ещё не готовы визуально из-за декоративного placeholder-постера.
  return true
}

export default async function Catalog(){
  const rawAnime = await getAnimeList({limit:1000})
  const anime = rawAnime.filter(isRenderableCatalogItem)
  const clientAnime = compactAnimeItems(anime, 900, { descriptionLimit: 260, genresLimit: 10 })
  return <main className="page catalog-page"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(animeListJsonLd(anime, '/catalog'))}} />
    <div className="page-head catalog-hero-head"><Link href="/">← На главную</Link><h1>Каталог аниме</h1><p>Удобная база тайтлов: фильтры, быстрый поиск, крупные постеры и аккуратная сетка без перегруза.</p></div>
    <CatalogClient items={clientAnime}/>
  </main>
}
