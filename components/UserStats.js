'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

function read(key){
  try{ return JSON.parse(localStorage.getItem(key) || '[]') }catch{ return [] }
}

export default function UserStats(){
  const [favorites,setFavorites] = useState([])
  const [history,setHistory] = useState([])
  const [ratings,setRatings] = useState({})

  useEffect(()=>{
    setFavorites(read('anime:favorites'))
    setHistory(read('anime:history'))
    try{ setRatings(JSON.parse(localStorage.getItem('anime:ratings') || '{}')) }catch{ setRatings({}) }
  }, [])

  const avg = useMemo(()=>{
    const values = Object.values(ratings).map(Number).filter(Boolean)
    if(!values.length) return '—'
    return (values.reduce((a,b)=>a+b,0)/values.length).toFixed(1)
  }, [ratings])

  return <>
    <section className="catalog-tools widget">
      <div className="filter-grid">
        <div><span>Избранное</span><h2>{favorites.length}</h2></div>
        <div><span>История</span><h2>{history.length}</h2></div>
        <div><span>Оценок</span><h2>{Object.keys(ratings).length}</h2></div>
        <div><span>Средняя оценка</span><h2>{avg}</h2></div>
      </div>
    </section>
    <div className="section-title"><h2><span>◷</span>Последние просмотры</h2><Link href="/history">История ›</Link></div>
    <div className="poster-row">
      {history.slice(0,5).map(a=><Link className="poster" href={`/anime/${a.slug}`} key={a.slug} prefetch={false}>
        <img loading="lazy" decoding="async" width="320" height="480" src={a.poster} alt={a.title ? `Постер аниме ${a.title}` : 'Постер аниме'}/><div className="rating">серия {a.episode || 1}</div><div className="poster-info"><b>{a.title}</b><span>{a.meta}</span></div>
      </Link>)}
    </div>
  </>
}
