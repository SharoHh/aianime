'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

function readHistory(){
  try{ return JSON.parse(localStorage.getItem('anime:history') || '[]') }catch{ return [] }
}

export default function RightContinueWatchingClient({ fallback = [] }){
  const [item, setItem] = useState(null)

  useEffect(() => {
    const history = readHistory()
    const first = history[0] || fallback[0] || null
    setItem(first)
  }, [fallback])

  if(!item){
    return <div className="widget watch"><div className="widget-head"><h3>▷ Продолжить просмотр</h3><Link href="/catalog">Каталог</Link></div><div className="watch-empty">История пока пустая. Открой любой тайтл и нажми “Смотреть”.</div></div>
  }

  const episode = item.episode || 1
  const progress = item.progress || 12

  return <div className="widget watch">
    <div className="widget-head"><h3>▷ Продолжить просмотр</h3><Link href="/history">Смотреть все</Link></div>
    <Link className="watch-banner" href={`/anime/${item.slug}#player`}>
      <img src={item.banner || item.poster}/>
      <div><b>{item.title}</b><span>{item.episode ? `Серия ${item.episode}` : (item.meta || 'Продолжить')}</span><div className="bar"><i style={{width:`${progress}%`}}/></div></div>
      <button type="button">▶</button>
    </Link>
  </div>
}
