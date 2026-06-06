'use client'

// AIanime v126: latest additions use the same tall card format as Popular Now without extra status chips.
import Link from 'next/link'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import { trackPopularityEvent } from '@/components/PopularityTrackerClient'
import HomeSectionIcon from '@/components/HomeSectionIcon'

function cleanText(value){
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function metaLine(item){
  const parts = []
  if(item?.kind === 'movie') parts.push('Фильм')
  else parts.push('Сериал')
  if(item?.year) parts.push(String(item.year))
  if(item?.episodes) parts.push(`${item.episodes} сер.`)
  return parts.filter(Boolean).join(' • ')
}


export default function HomeNewOnSiteClient({ anime = [] }){
  const visible = Array.isArray(anime) ? anime.filter(item => item?.slug && item?.title).slice(0, 5) : []
  if(!visible.length) return null

  return <section className="home-new-site" aria-label="Новое на сайте">
    <div className="section-title home-new-title">
      <div>
        <h2><HomeSectionIcon type="new"/>Новое на сайте</h2>
        <p>Последние добавленные тайтлы. Онгоинги оставим в расписании и отдельных подборках.</p>
      </div>
      <Link href="/catalog">В каталог ›</Link>
    </div>
    <div className="home-new-grid">
      {visible.map((item, index) => <Link
        href={`/anime/${item.slug}`}
        className="home-new-card"
        key={item.slug}
        onClick={() => trackPopularityEvent(item.slug, 'click')}
      >
        <img loading={index < 2 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : undefined} decoding="async" width="420" height="590" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/>
        <GlobalRatingBadge slug={item.slug} score={item.rating} count={item.siteRatingCount}/>
        <div className="home-new-shade" />
        <div className="home-new-copy">
          <b>{item.title}</b>
          {item.originalTitle || item.englishTitle ? <em>{cleanText(item.originalTitle || item.englishTitle)}</em> : null}
          <small>{metaLine(item)}</small>
        </div>
      </Link>)}
    </div>
  </section>
}
