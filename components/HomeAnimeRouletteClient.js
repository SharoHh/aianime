'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

function normalizeItems(items){
  return (Array.isArray(items) ? items : [])
    .filter(item => item?.slug && (item?.poster || item?.banner))
    .slice(0, 60)
}

function pickDifferentIndex(length, current){
  if(length <= 1) return 0
  const offset = 1 + Math.floor(Math.random() * (length - 1))
  return (current + offset) % length
}

export default function HomeAnimeRouletteClient({ items = [] }){
  const safeItems = useMemo(() => normalizeItems(items), [items])
  const [index, setIndex] = useState(0)

  if(!safeItems.length) return null

  const currentIndex = Math.min(index, safeItems.length - 1)
  const item = safeItems[currentIndex]
  const title = item.displayTitle || item.title || 'Без названия'
  const image = item.banner || item.poster
  const genres = Array.isArray(item.genres) ? item.genres.filter(Boolean).slice(0, 2) : []
  const episodes = Number(item.episodes || 0)
  const rating = item.rating && item.rating !== '—' ? item.rating : null

  function spin(){
    setIndex(current => pickDifferentIndex(safeItems.length, current))
  }

  return <section className="widget home-roulette-widget">
    <div className="widget-head home-roulette-head">
      <div>
        <span className="home-roulette-kicker">Случайный выбор</span>
        <h3>Аниме-рулетка</h3>
      </div>
      <button type="button" className="home-roulette-dice" onClick={spin} aria-label="Выбрать другое аниме">🎲</button>
    </div>

    <div className="home-roulette-card" key={item.slug}>
      <Link href={`/anime/${item.slug}`} className="home-roulette-cover" prefetch={false}>
        <img src={image} alt={title ? `Кадр из аниме ${title}` : 'Кадр из аниме'} width="640" height="360" loading="lazy" decoding="async" />
        <span className="home-roulette-badge">Выпало тебе</span>
      </Link>

      <div className="home-roulette-body">
        <Link href={`/anime/${item.slug}`} className="home-roulette-title" prefetch={false}>{title}</Link>
        <div className="home-roulette-meta">
          {rating ? <span>★ {rating}</span> : null}
          {episodes ? <span>{episodes} серий</span> : null}
          {genres.map(genre => <span key={genre}>{genre}</span>)}
        </div>
        <div className="home-roulette-actions">
          <Link href={`/anime/${item.slug}`} className="home-roulette-watch" prefetch={false}>▶ Смотреть</Link>
          <button type="button" className="home-roulette-spin" onClick={spin}>Крутить ещё</button>
        </div>
      </div>
    </div>
  </section>
}
