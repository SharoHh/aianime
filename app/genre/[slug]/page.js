export const dynamic = 'force-dynamic'

import Link from 'next/link'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import { getAnimeList } from '@/lib/animeRepository'
import { decodeRouteSlug, slugifyRu, titleFromSlug } from '@/lib/routeSlugs'

function uniqueGenres(items){
  const map = new Map()
  for(const item of items){
    for(const genre of item.genres || []){
      const title = String(genre || '').trim()
      if(!title) continue
      const slug = slugifyRu(title)
      if(!map.has(slug)) map.set(slug, title)
    }
  }
  return map
}

function getGenreMatch(items, rawSlug){
  const target = slugifyRu(decodeRouteSlug(rawSlug))
  const genres = uniqueGenres(items)
  const title = genres.get(target) || titleFromSlug(target)
  const filtered = items
    .filter(item => (item.genres || []).some(genre => slugifyRu(genre) === target))
    .sort((a,b)=>Number(b.score || 0)-Number(a.score || 0))

  return { target, title, filtered, exists: genres.has(target) }
}

export async function generateMetadata({ params }){
  const resolvedParams = await params
  const anime = await getAnimeList({limit:1000})
  const { title } = getGenreMatch(anime, resolvedParams.slug)
  return {
    title: `${title} аниме — Aianime`,
    description: `Подборка аниме в жанре ${title}: рейтинг, описания, постеры и похожие тайтлы.`
  }
}

export default async function GenrePage({ params }){
  const resolvedParams = await params
  const anime = await getAnimeList({limit:1000})
  const { title, filtered } = getGenreMatch(anime, resolvedParams.slug)

  return <main className="page seo-page">
    <div className="page-head seo-head">
      <Link href="/genres">← Все жанры</Link>
      <h1>{title}</h1>
      <p>{filtered.length ? `${filtered.length} тайтлов в этом жанре. Отсортировано по рейтингу и популярности.` : 'Пока в этой подборке нет тайтлов. Открой каталог и выбери близкий жанр через фильтры.'}</p>
    </div>

    {filtered.length ? <div className="poster-row seo-poster-row">
      {filtered.slice(0,40).map(a=><Link className="poster" href={`/anime/${a.slug}`} key={a.slug}>
        <img loading="lazy" decoding="async" src={a.poster} alt={a.title || 'Аниме'}/>
        <GlobalRatingBadge slug={a.slug} score={a.rating} count={a.siteRatingCount}/>
        <div className="poster-info"><b>{a.title}</b><span>{a.meta}</span></div>
      </Link>)}
    </div> : <section className="empty-state widget">
      <h2>Подборка пока пустая</h2>
      <p>Жанры обновляются из Supabase и Kodik. Возможно, этот раздел появится после следующей синхронизации.</p>
      <Link className="primary" href="/catalog">Открыть каталог</Link>
    </section>}
  </main>
}
