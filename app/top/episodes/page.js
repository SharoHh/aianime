export const revalidate = 120

import Link from 'next/link'
import { getAnimeList } from '@/lib/animeRepository'

export const metadata = {
  title:'Длинные аниме — Aianime',
  description:'Тайтлы с большим количеством серий.'
}

export default async function TopListPage(){
  const anime = await getAnimeList({limit:1000})
  const items = [...anime].sort((a,b)=>{
    if('episodes' === 'rating') return Number(b.score)-Number(a.score)
    if('episodes' === 'popular') return Number(b.popularity || b.score)-Number(a.popularity || a.score)
    if('episodes' === 'new') return Number(b.year || 0)-Number(a.year || 0)
    return Number(b.episodes || 0)-Number(a.episodes || 0)
  }).slice(0,50)

  return <main className="page seo-page">
    <div className="page-head seo-head"><Link href="/top">← Все топы</Link><h1>Длинные аниме</h1><p>Тайтлы с большим количеством серий.</p></div>
    <section className="top-list">
      {items.map((a,index)=><Link className="top-list-item widget" href={`/anime/${a.slug}`} key={a.slug}>
        <strong>{index+1}</strong>
        <img loading="lazy" decoding="async" src={a.poster}/>
        <div><b>{a.title}</b><span>{a.year} · {a.meta} · {(a.genres || []).slice(0,3).join(' · ')}</span></div>
        <em>★ {a.rating}</em>
      </Link>)}
    </section>
  </main>
}
