export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAnimeList } from '@/lib/animeRepository'

function slugify(text){
  return String(text).toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,'-').replace(/^-|-$/g,'')
}

export async function generateMetadata({ params }){
  const { slug } = await params
  const anime = await getAnimeList({limit:1000})
  const genre = [...new Set(anime.flatMap(a=>a.genres || []))].find(g => slugify(g) === slug)
  return {
    title: genre ? `${genre} аниме — Aianime` : 'Жанр аниме — Aianime',
    description: genre ? `Лучшие аниме в жанре ${genre}: рейтинг, описание, постеры и похожие тайтлы.` : 'Подборка аниме по жанру.'
  }
}

export default async function GenrePage({ params }){
  const { slug } = await params
  const anime = await getAnimeList({limit:1000})
  const genre = [...new Set(anime.flatMap(a=>a.genres || []))].find(g => slugify(g) === slug)
  if(!genre) notFound()
  const items = anime.filter(a => (a.genres || []).includes(genre)).sort((a,b)=>Number(b.score)-Number(a.score))

  return <main className="page seo-page">
    <div className="page-head seo-head"><Link href="/genres">← Все жанры</Link><h1>{genre}</h1><p>{items.length} тайтлов в этом жанре. Отсортировано по рейтингу и популярности.</p></div>
    <div className="poster-row seo-poster-row">
      {items.slice(0,20).map(a=><Link className="poster" href={`/anime/${a.slug}`} key={a.slug}><img loading="lazy" decoding="async" src={a.poster}/><div className="rating">★ {a.rating}</div><div className="poster-info"><b>{a.title}</b><span>{a.meta}</span></div></Link>)}
    </div>
  </main>
}
