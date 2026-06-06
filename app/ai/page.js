export const dynamic = 'force-dynamic'

export const metadata = {
  title:'AI-подбор аниме по настроению — AIanime',
  description:'AI-подбор аниме на русском: опиши настроение, любимые тайтлы или вайб — AIanime подберёт подходящие варианты из каталога.',
  alternates:{ canonical:'/ai' },
  openGraph:{ title:'AI-подбор аниме — AIanime', description:'Персональные рекомендации аниме по настроению и предпочтениям.', url:'/ai', type:'website' }
}

import Link from 'next/link'
import { getAnimeList } from '@/lib/animeRepository'
import AiClient from './AiClient'
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

export default async function Page({ searchParams }){
  const anime = compactAnimeItems(await getAnimeList({ limit: 1000 }), 1000, { descriptionLimit: 320, genresLimit: 10 })
  const resolvedSearchParams = await searchParams
  const similarSlug = resolvedSearchParams?.similar || null
  const initialQuery = resolvedSearchParams?.q || null
  return <main className="page">
    <div className="page-head"><Link href="/">← На главную</Link><h1>AI-подбор</h1><p>Опиши настроение, похожий тайтл или ситуацию — AI подберёт варианты из каталога.</p></div>
    <div className="ai-extra-link"><Link className="secondary" href="/ai/quiz">Пройти короткий AI-опрос</Link></div>
    <AiClient items={anime} similarSlug={similarSlug} initialQuery={initialQuery}/>
  </main>
}
