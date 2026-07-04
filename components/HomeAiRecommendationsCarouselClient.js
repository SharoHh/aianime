'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const MATCHES = [94, 91, 89, 92, 88, 90, 87, 93, 86]

export default function HomeAiRecommendationsCarouselClient({ items = [] }){
  const trackRef = useRef(null)
  const [index, setIndex] = useState(0)

  const safeItems = Array.isArray(items) ? items.filter(item => item?.slug).slice(0, 9) : []

  function cardStep(){
    const track = trackRef.current
    const card = track?.querySelector('.ai-dashboard-card')
    if(!track || !card) return 0
    const styles = window.getComputedStyle(track)
    const gap = Number.parseFloat(styles.columnGap || styles.gap || '0') || 0
    return card.getBoundingClientRect().width + gap
  }

  function move(direction){
    const track = trackRef.current
    if(!track || safeItems.length < 2) return

    const step = cardStep()
    if(!step) return

    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth)
    const nearEnd = track.scrollLeft >= maxScroll - Math.max(8, step / 3)
    const nearStart = track.scrollLeft <= 8

    if(direction > 0 && nearEnd){
      track.scrollTo({ left:0, behavior:'smooth' })
      setIndex(0)
      return
    }

    if(direction < 0 && nearStart){
      track.scrollTo({ left:maxScroll, behavior:'smooth' })
      setIndex(Math.max(0, safeItems.length - 1))
      return
    }

    track.scrollBy({ left:direction * step, behavior:'smooth' })
    setIndex(current => Math.max(0, Math.min(safeItems.length - 1, current + direction)))
  }

  useEffect(() => {
    const track = trackRef.current
    if(!track) return undefined

    function syncIndex(){
      const step = cardStep()
      if(step > 0) setIndex(Math.max(0, Math.round(track.scrollLeft / step)))
    }

    track.addEventListener('scroll', syncIndex, { passive:true })
    window.addEventListener('resize', syncIndex)
    return () => {
      track.removeEventListener('scroll', syncIndex)
      window.removeEventListener('resize', syncIndex)
    }
  }, [])

  if(!safeItems.length) return null

  return <div className="ai-dashboard-carousel">
    <div className="ai-dashboard-sidehead">
      <h2>Рекомендуем тебе</h2>
      <div className="ai-dashboard-controls">
        <button type="button" className="ai-dashboard-control ai-dashboard-control-prev" onClick={() => move(-1)} aria-label="Предыдущие рекомендации">‹</button>
        <button type="button" className="ai-dashboard-control ai-dashboard-control-next" onClick={() => move(1)} aria-label="Следующие рекомендации">›</button>
      </div>
    </div>

    <div className="ai-dashboard-carousel-frame">
      <div className="ai-dashboard-track" ref={trackRef}>
        {safeItems.map((item, itemIndex) => {
          const title = item.displayTitle || item.title || 'Без названия'
          const subtitle = item.originalTitle || item.englishTitle || item.meta || ''
          const image = item.banner || item.poster
          return <Link href={`/anime/${item.slug}`} key={item.slug} className="ai-dashboard-card" prefetch={false}>
            <div className="ai-dashboard-card-coverwrap">
              <img loading="lazy" decoding="async" width="480" height="300" src={image} alt={title ? `Кадр из аниме ${title}` : 'Кадр из аниме'} className="ai-dashboard-card-cover"/>
              <span className="ai-dashboard-match">{MATCHES[itemIndex] || 88}% совпадение</span>
              <span className="ai-dashboard-favorite" aria-hidden="true">♡</span>
            </div>
            <div className="ai-dashboard-card-body">
              <b>{title}</b>
              {subtitle ? <span className="ai-dashboard-card-subtitle">{subtitle}</span> : null}
              <div className="ai-dashboard-card-tags">{(item.genres || []).slice(0,2).map(genre => <i key={genre}>{genre}</i>)}</div>
              <div className="ai-dashboard-card-rating">★ {item.rating || '—'}</div>
            </div>
          </Link>
        })}
      </div>
      <button type="button" className="ai-dashboard-edge-next" onClick={() => move(1)} aria-label="Следующие рекомендации">›</button>
    </div>

    <div className="ai-dashboard-dots" aria-hidden="true">
      {safeItems.slice(0, Math.min(5, safeItems.length)).map((item, dotIndex) => <i key={item.slug} className={dotIndex === Math.min(index, 4) ? 'is-active' : ''}/>) }
    </div>
  </div>
}
