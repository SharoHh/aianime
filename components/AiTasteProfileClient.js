'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { getFavorites, getHistory, getRatings, readJson } from '@/lib/userStorage'

function countGenres(items){
  const map = new Map()
  for(const item of items){
    for(const g of item.genres || []){
      map.set(g, (map.get(g) || 0) + 1)
    }
  }
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4)
}

export default function AiTasteProfileClient({ items = [] }){
  const history = typeof window !== 'undefined' ? getHistory() : []
  const favorites = typeof window !== 'undefined' ? getFavorites() : []
  const ratings = typeof window !== 'undefined' ? getRatings() : {}
  const aiHistory = typeof window !== 'undefined' ? readJson('ai_query_history', []) : []

  const matchedItems = useMemo(()=>{
    const slugs = new Set([...history, ...favorites].map(x => x.slug))
    return items.filter(x => slugs.has(x.slug))
  }, [items])

  const topGenres = countGenres(matchedItems)
  const topRated = Object.entries(ratings).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,3)

  const query = topGenres.length
    ? `подбери аниме в жанрах ${topGenres.map(([g])=>g).join(', ')}`
    : aiHistory[0] || 'подбери аниме под мой вкус'

  return <section className="widget taste-profile">
    <div className="widget-head"><h3>AI-профиль вкуса</h3><Link href={`/ai?q=${encodeURIComponent(query)}`}>Подобрать ›</Link></div>
    <div className="taste-grid">
      <div><span>История</span><b>{history.length}</b></div>
      <div><span>Избранное</span><b>{favorites.length}</b></div>
      <div><span>Оценки</span><b>{Object.keys(ratings).length}</b></div>
    </div>
    {topGenres.length ? <div className="taste-tags">
      {topGenres.map(([genre,count])=><span key={genre}>{genre} · {count}</span>)}
    </div> : <p className="taste-empty">Открой несколько тайтлов, добавь их в избранное или поставь оценки — AI начнёт лучше понимать вкус.</p>}
    {topRated.length ? <div className="taste-rated">{topRated.map(([slug,value])=><span key={slug}>★ {value}/5 · {slug}</span>)}</div> : null}
  </section>
}
