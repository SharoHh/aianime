export const dynamic = 'force-dynamic'

import Link from 'next/link'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import { getAnimeList } from '@/lib/animeRepository'
import { collectionPageJsonLd, jsonLd } from '@/lib/seo'

export const metadata = {
  title: 'Длинные аниме и тайтлы с большим числом серий — AIanime',
  description: 'Аниме с большим количеством серий: длинные сериалы, популярные франшизы и тайтлы для долгого просмотра.',
  alternates: { canonical: '/top/episodes' },
  openGraph: { title: 'Длинные аниме и тайтлы с большим числом серий — AIanime', description: 'Аниме с большим количеством серий: длинные сериалы, популярные франшизы и тайтлы для долгого просмотра.', url: '/top/episodes', type: 'website' }
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
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(collectionPageJsonLd({
      name:'Длинные аниме',
      description:'Список тайтлов AIanime в разделе длинные аниме.',
      path:'/top/episodes',
      items:items.slice(0, 24).map(item => ({ title:item.title, slug:item.slug }))
    }))}} />
    <div className="page-head seo-head"><Link href="/top">← Все топы</Link><h1>Длинные аниме</h1><p>Тайтлы с большим количеством серий.</p></div>
    <section className="top-list">
      {items.map((a,index)=><Link className="top-list-item widget" href={`/anime/${a.slug}`} key={a.slug}>
        <strong>{index+1}</strong>
        <img loading="lazy" decoding="async" width="320" height="480" src={a.poster} alt={a.title ? `Постер аниме ${a.title}` : 'Постер аниме'}/>
        <div><b>{a.title}</b><span>{a.year} · {a.meta} · {(a.genres || []).slice(0,3).join(' · ')}</span></div>
        <GlobalRatingBadge slug={a.slug} score={a.rating} count={a.siteRatingCount} className="top-list-rating-badge"/>
      </Link>)}
    </section>
  </main>
}
