'use client'

// AIanime v125: popular block uses real actions internally, but does not expose raw action counts in UI.
import Link from 'next/link'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import { trackPopularityEvent } from '@/components/PopularityTrackerClient'

const PAGE_SIZE = 5

function cleanText(value){
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function statusLabel(item){
  const actions = Number(item?.livePopularityActions || 0) || 0
  const status = String(item?.status || '').toLowerCase()
  // Сырые счётчики вроде "1 действие" не показываем пользователю:
  // они нужны только для сортировки популярности, а в карточке выглядят как баг.
  if(actions > 0) return 'Сейчас смотрят'
  if(status === 'ongoing') return 'Онгоинг'
  if(item?.kind === 'movie') return 'Фильм'
  return 'В тренде'
}

function metaLine(item){
  const parts = []
  if(item?.year) parts.push(String(item.year))
  if(item?.meta) parts.push(cleanText(item.meta))
  else if(item?.episodes) parts.push(`${item.episodes} серий`)
  return parts.filter(Boolean).slice(0,2).join(' • ')
}

export default function HomePopularNowClient({ anime = [] }){
  const visible = Array.isArray(anime) ? anime.filter(item => item?.slug && item?.title).slice(0, PAGE_SIZE) : []
  if(!visible.length) return null

  return <section className="home-popular-live home-popular-real" aria-label="Популярное сейчас">
    <div className="section-title popular-live-title">
      <div>
        <h2><span>♨</span>Популярное сейчас</h2>
        <p>Считаем по действиям пользователей: просмотры, переходы, продолжение просмотра, оценки и избранное.</p>
      </div>
      <Link href="/catalog">Смотреть все ›</Link>
    </div>

    <div className="popular-live-grid">
      {visible.map((item, index) => <Link
        href={`/anime/${item.slug}`}
        className="popular-live-card"
        key={item.slug}
        onClick={() => trackPopularityEvent(item.slug, 'click')}
        style={{'--card-delay': `${index * 35}ms`}}
      >
        <img loading={index < 2 ? 'eager' : 'lazy'} decoding="async" src={item.poster} alt={item.title}/>
        <GlobalRatingBadge slug={item.slug} score={item.rating} count={item.siteRatingCount}/>
        <div className="popular-live-shade" />
        <div className="popular-live-copy">
          <span className="popular-live-tag">{statusLabel(item)}</span>
          <b>{item.title}</b>
          {item.originalTitle || item.englishTitle ? <em>{item.originalTitle || item.englishTitle}</em> : null}
          <small>{metaLine(item)}</small>
        </div>
      </Link>)}
    </div>
  </section>
}
