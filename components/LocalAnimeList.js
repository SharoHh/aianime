'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { clearAnimeData } from '@/lib/userStorage'
import { pushToast } from '@/components/ToastCenter'


function safePoster(raw){
  const text = String(raw || '').trim()
  if(!text) return '/posters/magic2.svg'
  if(text.startsWith('/')) return text
  if(/^https?:\/\//i.test(text)) return `/api/image?url=${encodeURIComponent(text)}&fallback=${encodeURIComponent('/posters/magic2.svg')}`
  return '/posters/magic2.svg'
}

function readItems(storageKey){
  try{ return JSON.parse(localStorage.getItem(storageKey) || '[]') }catch{ return [] }
}

function itemHref(item, storageKey){
  if(storageKey === 'anime:history'){
    const episode = Math.max(1, Number(item?.episode || 1))
    return `/anime/${item.slug}?episode=${episode}#player`
  }
  return `/anime/${item.slug}`
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
    <div className="filter-summary"><b>{items.length}</b> тайтлов <button type="button" onClick={clear}>Очистить</button></div>
    <div className="catalog-grid">
      {items.map(a=><Link className="poster" href={itemHref(a, storageKey)} key={a.slug}>
        <img loading="lazy" decoding="async" src={safePoster(a.poster)}/><div className="rating">★ {a.rating || '—'}</div><div className="poster-info"><b>{a.title || 'Без названия'}</b><span>{storageKey === 'anime:history' ? `Серия ${a.episode || 1}${a.progress ? ` · ${Math.round(a.progress)}%` : ''}` : (a.meta || '')}</span></div>
      </Link>)}
    </div>
  </>
}
