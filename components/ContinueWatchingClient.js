'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

function readHistory(){
  try{ return JSON.parse(localStorage.getItem('anime:history') || '[]') }catch{ return [] }
}

export default function ContinueWatchingClient({ fallback = [] }){
  const [items,setItems] = useState([])

  useEffect(()=>{
    const history = readHistory()
    setItems(history.length ? history.slice(0,4) : fallback.slice(0,4))
  }, [fallback])

  if(!items.length) return null

  return <div className="continue-row">
    {items.map(item => <Link href={`/anime/${item.slug}#player`} className="continue-card" key={item.slug}>
      <img src={item.poster} alt="Аниме"/>
      <div className="play">▶</div>
      <div className="continue-info"><b>{item.title}</b><span>{item.episode ? `Серия ${item.episode}` : item.meta}</span><div className="bar"><i style={{width:(item.progress || 18)+'%'}}/></div></div>
      <em>{item.progress || 18}%</em>
    </Link>)}
  </div>
}
