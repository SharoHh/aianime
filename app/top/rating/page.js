export const dynamic = 'force-dynamic'

import Link from 'next/link'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import { getAnimeList } from '@/lib/animeRepository'

export const metadata = {
  title:'Топ по рейтингу — Aianime',
  description:'Самые высоко оценённые аниме.'
}

export default async function TopListPage(){
  const anime = await getAnimeList({limit:1000})
  const items = [...anime].sort((a,b)=>{
    if('rating' === 'rating') return Number(b.score)-Number(a.score)
    if('rating' === 'popular') return Number(b.popularity || b.score)-Number(a.popularity || a.score)
    if('rating' === 'new') return Number(b.year || 0)-Number(a.year || 0)
    return Number(b.episodes || 0)-Number(a.episodes || 0)
  }).slice(0,50)

  return <main className="page seo-page">
    <div className="page-head seo-head"><Link href="/top">← Все топы</Link><h1>Топ по рейтингу</h1><p>Самые высоко оценённые аниме.</p></div>
    <section className="top-list">
      {items.map((a,index)=><Link className="top-list-item widget" href={`/anime/${a.slug}`} key={a.slug}>
        <strong>{index+1}</strong>
        <img loading="lazy" decoding="async" src={a.poster}/>
        <div><b>{a.title}</b><span>{a.year} · {a.meta} · {(a.genres || []).slice(0,3).join(' · ')}</span></div>
        <GlobalRatingBadge slug={a.slug} score={a.rating} count={a.siteRatingCount} className="top-list-rating-badge"/>
      </Link>)}
    </section>
  </main>
}
