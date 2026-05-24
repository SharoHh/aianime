'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function LocalAnimeList({ storageKey, emptyTitle, emptyText }){
  const [items,setItems] = useState([])

  useEffect(()=>{
    try{ setItems(JSON.parse(localStorage.getItem(storageKey) || '[]')) }catch{ setItems([]) }
  }, [storageKey])

  function clear(){
    localStorage.removeItem(storageKey)
    setItems([])
  }

  if(!items.length){
    return <div className="widget" style={{maxWidth:720}}><h2>{emptyTitle}</h2><p>{emptyText}</p><Link className="primary" href="/catalog">Открыть каталог</Link></div>
  }

  return <>
    <div className="filter-summary"><b>{items.length}</b> тайтлов <button onClick={clear}>Очистить</button></div>
    <div className="catalog-grid">
      {items.map(a=><Link className="poster" href={`/anime/${a.slug}`} key={a.slug}>
        <img loading="lazy" decoding="async" src={a.poster}/><div className="rating">★ {a.rating}</div><div className="poster-info"><b>{a.title}</b><span>{a.meta}</span></div>
      </Link>)}
    </div>
  </>
}
