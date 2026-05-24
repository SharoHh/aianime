'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

function score(item, query){
  const q = query.toLowerCase().trim()
  if(!q) return 0
  const title = `${item.title || ''} ${item.originalTitle || ''}`.toLowerCase()
  const text = `${title} ${(item.genres || []).join(' ')} ${item.description || ''}`.toLowerCase()
  let value = 0
  if(title.includes(q)) value += 40
  for(const part of q.split(/\s+/).filter(Boolean)){
    if(title.includes(part)) value += 16
    if(text.includes(part)) value += 5
  }
  value += Number(item.score || item.rating || 0)
  return value
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
          {['романтика','экшен','психология','короткое','онгоинг'].map(x=><button key={x} onClick={()=>setQuery(x)}>{x}</button>)}
        </div>

        <div className="global-search-results">
          {results.length ? results.map(item=><Link onClick={()=>setOpen(false)} href={`/anime/${item.slug}`} className="global-search-item" key={item.slug}>
            <img src={item.poster} alt="Аниме"/>
            <div><b>{item.title}</b><span>{item.year} · {item.meta} · ★ {item.rating}</span><p>{(item.genres || []).slice(0,3).join(' · ')}</p></div>
          </Link>) : <div className="global-search-empty">Ничего не найдено. Попробуй написать жанр или похожий тайтл.</div>}
        </div>

        <Link onClick={()=>setOpen(false)} href={`/ai?q=${encodeURIComponent(query || 'что посмотреть вечером')}`} className="global-search-ai">✦ Подобрать через AI</Link>
      </section>
    </div> : null}
  </>
}
