'use client'

// AIanime v294: current-season ongoing titles on the home page.
import Link from 'next/link'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import { trackPopularityEvent } from '@/components/PopularityTrackerClient'
import HomeSectionIcon from '@/components/HomeSectionIcon'
import { isPublicReadyAnimeItem } from '@/lib/animeQuality'

const PAGE_SIZE = 5

function cleanText(value){
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function metaLine(item){
  const parts = []
  parts.push('Онгоинг')
  if(item?.episodes) parts.push(`${item.episodes} серий`)
  else if(item?.year) parts.push(String(item.year))
  return parts.filter(Boolean).slice(0,2).join(' • ')
}

export default function HomeSeasonNowClient({ anime = [], title = 'Аниме текущего сезона', seasonLabel = '' }){
  const visible = Array.isArray(anime) ? anime.filter(isPublicReadyAnimeItem).slice(0, PAGE_SIZE) : []
  if(!visible.length) return null

  return <section className="home-popular-live home-popular-real" aria-label={title}>
    <div className="section-title popular-live-title">
      <div>
        <h2><HomeSectionIcon type="schedule"/>{title}</h2>
        <p>{seasonLabel ? `Только онгоинги сезона ${seasonLabel} из текущего расписания AIanime.` : 'Только онгоинги текущего сезона из расписания AIanime.'}</p>
      </div>
      <Link href="/season">Все онгоинги ›</Link>
    </div>

    <div className="popular-live-grid">
      {visible.map((item, index) => <Link
        href={`/anime/${item.slug}`}
        className="popular-live-card"
        key={item.slug}
        onClick={() => trackPopularityEvent(item.slug, 'click')}
        style={{'--card-delay': `${index * 35}ms`}}
       prefetch={false}>
        <img loading="lazy" decoding="async" width="420" height="590" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/>
        <GlobalRatingBadge slug={item.slug} score={item.rating} count={item.siteRatingCount}/>
        <div className="popular-live-shade" />
        <div className="popular-live-copy">
          <b>{item.title}</b>
          {item.originalTitle || item.englishTitle ? <em>{item.originalTitle || item.englishTitle}</em> : null}
          <small>{metaLine(item)}</small>
        </div>
      </Link>)}
    </div>
  </section>
}
