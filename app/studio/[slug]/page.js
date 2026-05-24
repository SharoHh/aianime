export const revalidate = 120

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAnimeList } from '@/lib/animeRepository'

function slugify(text){
  return String(text || 'unknown').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,'-').replace(/^-|-$/g,'') || 'unknown'
}
function studioName(item){
  return item.studio && item.studio !== '—' ? item.studio : 'Неизвестная студия'
}

export async function generateMetadata({ params }){
  const { slug } = await params
  const anime = await getAnimeList({limit:1000})
  const studio = [...new Set(anime.map(studioName))].find(s => slugify(s) === slug)
  return {
    title: studio ? `${studio} — аниме студии | Aianime` : 'Студия аниме — Aianime',
    description: studio ? `Аниме студии ${studio}: список тайтлов, рейтинг, жанры и страницы просмотра.` : 'Страница студии аниме.'
  }
}

export default async function StudioPage({ params }){
  const { slug } = await params
  const anime = await getAnimeList({limit:1000})
  const studio = [...new Set(anime.map(studioName))].find(s => slugify(s) === slug)
  if(!studio) notFound()
  const items = anime.filter(a => studioName(a) === studio).sort((a,b)=>Number(b.score)-Number(a.score))

  return <main className="page seo-page">
    <div className="page-head seo-head"><Link href="/studios">← Все студии</Link><h1>{studio}</h1><p>{items.length} тайтлов студии.</p></div>
    <div className="poster-row seo-poster-row">
      {items.slice(0,20).map(a=><Link className="poster" href={`/anime/${a.slug}`} key={a.slug}><img loading="lazy" decoding="async" src={a.poster}/><div className="rating">★ {a.rating}</div><div className="poster-info"><b>{a.title}</b><span>{a.meta}</span></div></Link>)}
    </div>
  </main>
}
