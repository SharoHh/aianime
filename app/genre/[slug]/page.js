export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import { getAnimeList } from '@/lib/animeRepository'
import { decodeRouteSlug, slugifyRu, titleFromSlug } from '@/lib/routeSlugs'
import { buildPageMetadata, collectionPageJsonLd, jsonLd } from '@/lib/seo'

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
  const { title, filtered, exists } = getGenreMatch(anime, resolvedParams.slug)
  const path = `/genre/${encodeURIComponent(resolvedParams.slug).replace(/%2F/g, '/')}`

  if(!exists || !filtered.length){
    return buildPageMetadata({
      title:'Жанр не найден — AIanime',
      description:'В этом жанре пока нет тайтлов в каталоге AIanime.',
      path,
      index:false
    })
  }

  return buildPageMetadata({
    title:`${title} аниме смотреть онлайн — AIanime`,
    description:`${filtered.length} тайтлов в жанре ${title}: аниме онлайн на русском, постеры, рейтинги, описания и похожие тайтлы.`,
    path
  })
}

export default async function GenrePage({ params }){
  const resolvedParams = await params
  const anime = await getAnimeList({limit:1000})
  const { title, filtered, exists } = getGenreMatch(anime, resolvedParams.slug)
  if(!exists || !filtered.length) notFound()

  return <main className="page seo-page"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(collectionPageJsonLd({ name:`${title} аниме`, description:`Подборка аниме в жанре ${title} на AIanime.`, path:`/genre/${encodeURIComponent(resolvedParams.slug).replace(/%2F/g, '/')}`, items:filtered.slice(0, 24).map(item => ({ title:item.title, slug:item.slug })) }))}} />
    <div className="page-head seo-head">
      <Link href="/genres">← Все жанры</Link>
      <h1>{title}</h1>
      <p>{filtered.length} тайтлов в этом жанре. Отсортировано по рейтингу и популярности.</p>
    </div>

    <div className="poster-row seo-poster-row">
      {filtered.slice(0,40).map(a=><Link className="poster" href={`/anime/${a.slug}`} key={a.slug}>
        <img loading="lazy" decoding="async" src={a.poster} alt={a.title ? `Постер аниме ${a.title}` : 'Постер аниме'}/>
        <GlobalRatingBadge slug={a.slug} score={a.rating} count={a.siteRatingCount}/>
        <div className="poster-info"><b>{a.title}</b><span>{a.meta}</span></div>
      </Link>)}
    </div>
  </main>
}
