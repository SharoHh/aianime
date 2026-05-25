'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { clearAnimeData } from '@/lib/userStorage'
import { pushToast } from '@/components/ToastCenter'

function readItems(storageKey){
  try{ return JSON.parse(localStorage.getItem(storageKey) || '[]') }catch{ return [] }
}

export default function LocalAnimeList({ storageKey, emptyTitle, emptyText }){
  const [items,setItems] = useState([])

  useEffect(()=>{
    const load = () => setItems(readItems(storageKey))
    load()
    window.addEventListener('storage', load)
    window.addEventListener('anime:user-updated', load)
    return () => {
      window.removeEventListener('storage', load)
      window.removeEventListener('anime:user-updated', load)
    }
  }, [storageKey])

  function clear(){
    clearAnimeData(storageKey)
    setItems([])
    pushToast('Список очищен', 'success')
  }

  if(!items.length){
    return <div className="widget" style={{maxWidth:720}}><h2>{emptyTitle}</h2><p>{emptyText}</p><Link className="primary" href="/catalog">Открыть каталог</Link></div>
  }

  return <>
    <div className="filter-summary"><b>{items.length}</b> тайтлов <button onClick={clear}>Очистить</button></div>
    <div className="catalog-grid">
      {items.map(a=><Link className="poster" href={`/anime/${a.slug}`} key={a.slug}>
        <img loading="lazy" decoding="async" src={a.poster}/><div className="rating">★ {a.rating || '—'}</div><div className="poster-info"><b>{a.title}</b><span>{a.meta}</span></div>
      </Link>)}
    </div>
  </>
}
