export const dynamic = 'force-dynamic'

import Link from 'next/link'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import HomeSectionIcon from '@/components/HomeSectionIcon'
import { getAnimeList } from '@/lib/animeRepository'

function Poster({item}){
  return <Link href={`/anime/${item.slug}`} className="poster"><img loading="lazy" decoding="async" src={item.poster}/><GlobalRatingBadge slug={item.slug} score={item.rating} count={item.siteRatingCount}/><div className="poster-info"><b>{item.title}</b><span>{item.meta}</span></div></Link>
}

export const metadata = {
  title: 'Сезонное аниме — Aianime',
  description: 'Онгоинги, новинки сезона и популярные тайтлы.'
}

export default async function SeasonPage(){
  const anime = await getAnimeList({ limit: 1000 })
  const currentYear = new Date().getFullYear()
  const ongoing = anime.filter(a => a.status === 'ongoing').slice(0,10)
  const fresh = anime.filter(a => Number(a.year) >= currentYear - 1).sort((a,b)=>Number(b.score)-Number(a.score)).slice(0,10)
  const top = [...anime].sort((a,b)=>Number(b.score)-Number(a.score)).slice(0,10)

  return <main className="page season-page">
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
