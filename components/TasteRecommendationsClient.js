'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getFavorites, getHistory, getRatings } from '@/lib/userStorage'

export default function TasteRecommendationsClient(){
  const [items,setItems] = useState([])
  const [loading,setLoading] = useState(true)

  useEffect(()=>{
    let active = true
    async function load(){
      setLoading(true)
      try{
        const res = await fetch('/api/ai/taste', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({
            history: getHistory(),
            favorites: getFavorites(),
            ratings: getRatings()
          })
        })
        const payload = await res.json()
        if(active) setItems(payload?.results || [])
      }catch{
        if(active) setItems([])
      }finally{
        if(active) setLoading(false)
      }
    }
    load()
    window.addEventListener('anime:user-updated', load)
    return () => {
      active = false
      window.removeEventListener('anime:user-updated', load)
    }
  }, [])

  return <section className="widget taste-recs">
    <div className="widget-head"><h3>AI рекомендует по вкусу</h3><Link href="/ai">AI ›</Link></div>
    {loading ? <div className="taste-recs-loading">Анализируем историю...</div> : items.length ? <div className="taste-recs-grid">
      {items.slice(0,4).map(item=><Link href={`/anime/${item.slug}`} className="taste-rec-card" key={item.slug}>
        <img loading="lazy" decoding="async" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/>
        <div><span>AI {item.match}%</span><b>{item.title}</b><p>{item.reason}</p></div>
      </Link>)}
    </div> : <div className="taste-recs-loading">Недостаточно данных. Добавь тайтлы в историю или избранное.</div>}
  </section>
}
