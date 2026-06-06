'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { scoreCatalogItem } from '@/lib/searchRelevance'
import HomeSectionIcon from '@/components/HomeSectionIcon'

function score(item, query){
  return scoreCatalogItem(item, query)
}


export default function GlobalSearchOverlay({ items = [] }){
  const [open,setOpen] = useState(false)
  const [query,setQuery] = useState('')

  useEffect(()=>{
    const handler = (event) => {
      const key = String(event.key || '').toLowerCase()
      if((event.ctrlKey || event.metaKey) && key === 'k'){
        event.preventDefault()
        setOpen(true)
      }
      if(key === 'escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const results = useMemo(()=>{
    const q = query.trim()
    if(!q) return items.slice(0, 6)
    return [...items]
      .map(item => ({ item, value: score(item, q) }))
      .filter(x => x.value > 0)
      .sort((a,b)=>b.value-a.value)
      .slice(0,8)
      .map(x => x.item)
  }, [items, query])

  return <>
    <button type="button" className="search search-trigger" onClick={()=>setOpen(true)}>
      <span>⌕</span><strong>{query || 'Поиск аниме...'}</strong><kbd>Ctrl K</kbd>
    </button>

    {open ? <div className="global-search-overlay" role="dialog" aria-modal="true">
      <button className="global-search-backdrop" onClick={()=>setOpen(false)} aria-label="Закрыть поиск"/>
      <section className="global-search-modal">
        <div className="global-search-input">
          <span>⌕</span>
          <input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Найти аниме, жанр или настроение..." />
          <button onClick={()=>setOpen(false)}>esc</button>
        </div>

        <div className="global-search-chips">
          {['лёгкое позитивное','романтика','экшен','психология','короткое','онгоинг'].map(x=><button key={x} onClick={()=>setQuery(x)}>{x}</button>)}
        </div>

        <div className="global-search-results">
          {results.length ? results.map(item=><Link onClick={()=>setOpen(false)} href={`/anime/${item.slug}`} className="global-search-item" key={item.slug}>
            <img loading="lazy" decoding="async" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/>
            <div><b>{item.title}</b><span>{item.year} · {item.meta} · ★ {item.rating}</span><p>{(item.genres || []).slice(0,3).join(' · ')}</p></div>
          </Link>) : <div className="global-search-empty">Ничего не найдено. Попробуй название, жанр, настроение или похожий тайтл.</div>}
        </div>

        <Link onClick={()=>setOpen(false)} href={`/ai?q=${encodeURIComponent(query || 'что посмотреть вечером')}`} className="global-search-ai"><HomeSectionIcon type="ai"/> Подобрать через AI</Link>
      </section>
    </div> : null}
  </>
}
