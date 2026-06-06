export const dynamic = 'force-dynamic'

import Link from 'next/link'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import HomeSectionIcon from '@/components/HomeSectionIcon'
import { getAnimeList } from '@/lib/animeRepository'
import { collectionPageJsonLd, jsonLd } from '@/lib/seo'

function Poster({item}){
  return <Link href={`/anime/${item.slug}`} className="poster"><img loading="lazy" decoding="async" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/><GlobalRatingBadge slug={item.slug} score={item.rating} count={item.siteRatingCount}/><div className="poster-info"><b>{item.title}</b><span>{item.meta}</span></div></Link>
}

export const metadata = {
  title: 'Сезонное аниме и онгоинги — AIanime',
  description: 'Сезонное аниме, онгоинги, свежие релизы и популярные тайтлы текущего сезона на AIanime.',
  alternates: { canonical: '/season' },
  openGraph: { title: 'Сезонное аниме и онгоинги — AIanime', description: 'Сезонное аниме, онгоинги, свежие релизы и популярные тайтлы текущего сезона на AIanime.', url: '/season', type: 'website' }
}

export default async function SeasonPage(){
  const anime = await getAnimeList({ limit: 1000 })
  const currentYear = new Date().getFullYear()
  const ongoing = anime.filter(a => a.status === 'ongoing').slice(0,10)
  const fresh = anime.filter(a => Number(a.year) >= currentYear - 1).sort((a,b)=>Number(b.score)-Number(a.score)).slice(0,10)
  const top = [...anime].sort((a,b)=>Number(b.score)-Number(a.score)).slice(0,10)
  const schemaItems = [...ongoing, ...fresh, ...top].filter((item, index, list) => item?.slug && list.findIndex(x => x.slug === item.slug) === index).slice(0, 24).map(item => ({ title:item.title, slug:item.slug }))

  return <main className="page season-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(collectionPageJsonLd({
      name:'Сезонное аниме и онгоинги',
      description:'Онгоинги, новинки и популярные тайтлы текущего сезона на AIanime.',
      path:'/season',
      items:schemaItems
    }))}} />
    <div className="page-head"><Link href="/">← На главную</Link><h1>Сезонное аниме</h1><p>Онгоинги, свежие тайтлы и то, что сейчас чаще всего открывают.</p></div>

    <section className="season-hero widget">
      <div><span>сейчас смотрят</span><h2>Новые серии, тренды и топ сезона</h2><p>Страница собирается из уже загруженной базы, поэтому работает быстро и не зависит от внешних API на открытии.</p></div>
      <Link className="primary" href="/schedule">Расписание</Link>
    </section>

    <div className="section-title"><h2><HomeSectionIcon type="continue"/>Выходит сейчас</h2><Link href="/catalog">Каталог ›</Link></div>
    <div className="poster-row">{ongoing.slice(0,5).map(a=><Poster key={a.slug} item={a}/>)}</div>

    <div className="section-title"><h2><HomeSectionIcon type="new"/>Новинки</h2><Link href="/catalog">Все ›</Link></div>
    <div className="poster-row">{fresh.slice(0,5).map(a=><Poster key={a.slug} item={a}/>)}</div>

    <div className="section-title"><h2><HomeSectionIcon type="popular"/>Топ сезона</h2><Link href="/catalog">Все ›</Link></div>
    <div className="poster-row">{top.slice(0,5).map(a=><Poster key={a.slug} item={a}/>)}</div>
  </main>
}
