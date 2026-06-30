'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { scoreCatalogItem } from '@/lib/searchRelevance'
import HomeSectionIcon from '@/components/HomeSectionIcon'
import { isPublicReadyAnimeItem } from '@/lib/animeQuality'

const OPEN_SEARCH_EVENT = 'aianime:open-search'

function score(item, query){
  return scoreCatalogItem(item, query)
}

function cleanItems(items){
  return Array.isArray(items) ? items.filter(isPublicReadyAnimeItem) : []
}

function localSearch(items, query){
  const safe = cleanItems(items)
  const q = String(query || '').trim()
  if(!q) return safe.slice(0, 6)
  return safe
    .map(item => ({ item, value:score(item, q) }))
    .filter(entry => entry.value > 0)
    .sort((a,b) => b.value - a.value)
    .slice(0, 8)
    .map(entry => entry.item)
}

function SearchTrigger({ items = [], className = 'search search-trigger', label = 'Поиск аниме...' }){
  function open(){
    window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT, {
      detail:{ items:cleanItems(items) }
    }))
  }

  return <button type="button" className={className} onClick={open} aria-label="Открыть поиск по аниме">
    <HomeSectionIcon type="search"/><strong>{label}</strong><kbd>Ctrl K</kbd>
  </button>
}

function SearchModal(){
  const [open,setOpen] = useState(false)
  const [query,setQuery] = useState('')
  const [sourceItems,setSourceItems] = useState([])
  const [remoteResults,setRemoteResults] = useState([])
  const [remoteQuery,setRemoteQuery] = useState(null)
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState('')
  const [overlayTop,setOverlayTop] = useState(28)

  useEffect(()=>{
    const openHandler = (event) => {
      const nextItems = cleanItems(event?.detail?.items)
      if(nextItems.length) setSourceItems(nextItems)
      if(typeof event?.detail?.query === 'string') setQuery(event.detail.query)
      setOpen(true)
    }
    const keyHandler = (event) => {
      const key = String(event.key || '').toLowerCase()
      if((event.ctrlKey || event.metaKey) && key === 'k'){
        event.preventDefault()
        setOpen(true)
      }
      if(key === 'escape') setOpen(false)
    }
    window.addEventListener(OPEN_SEARCH_EVENT, openHandler)
    window.addEventListener('keydown', keyHandler)
    return () => {
      window.removeEventListener(OPEN_SEARCH_EVENT, openHandler)
      window.removeEventListener('keydown', keyHandler)
    }
  }, [])

  useEffect(()=>{
    if(!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  useEffect(()=>{
    if(!open) return

    let frame = 0
    let observer = null

    const syncTop = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const header = document.querySelector('[data-aianime-header]')
        const rect = header?.getBoundingClientRect?.()
        const headerBottom = rect && rect.bottom > 0 ? Math.ceil(rect.bottom) : 0
        setOverlayTop(Math.max(12, headerBottom + 12))
      })
    }

    syncTop()
    window.addEventListener('resize', syncTop)
    window.addEventListener('orientationchange', syncTop)

    const header = document.querySelector('[data-aianime-header]')
    if(header && typeof ResizeObserver !== 'undefined'){
      observer = new ResizeObserver(syncTop)
      observer.observe(header)
    }

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', syncTop)
      window.removeEventListener('orientationchange', syncTop)
      observer?.disconnect()
    }
  }, [open])

  const localResults = useMemo(()=>localSearch(sourceItems, query), [sourceItems, query])

  useEffect(()=>{
    if(!open) return
    const normalized = query.trim()
    const canUseLocalOnly = sourceItems.length >= 250 && normalized.length < 2

    if(canUseLocalOnly){
      setRemoteQuery(null)
      setRemoteResults([])
      setLoading(false)
      setError('')
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try{
        const params = new URLSearchParams({ q:normalized, limit:'8' })
        const response = await fetch(`/api/search?${params.toString()}`, {
          cache:'no-store',
          signal:controller.signal
        })
        const payload = await response.json().catch(()=>null)
        if(!response.ok || !payload?.ok) throw new Error(payload?.error || 'Поиск временно недоступен')
        setRemoteResults(cleanItems(payload.items))
        setRemoteQuery(normalized)
      }catch(searchError){
        if(searchError?.name === 'AbortError') return
        setRemoteResults([])
        setRemoteQuery(normalized)
        setError(searchError?.message || 'Поиск временно недоступен')
      }finally{
        if(!controller.signal.aborted) setLoading(false)
      }
    }, normalized ? 180 : 60)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, query, sourceItems.length])

  if(!open) return null

  const normalized = query.trim()
  const results = remoteQuery === normalized ? remoteResults : localResults

  return <div className="global-search-overlay" style={{ '--global-search-top':`${overlayTop}px` }} role="dialog" aria-modal="true" aria-label="Поиск по каталогу аниме">
    <button type="button" className="global-search-backdrop" onClick={()=>setOpen(false)} aria-label="Закрыть поиск"/>
    <section className="global-search-modal">
      <div className="global-search-input">
        <HomeSectionIcon type="search"/>
        <input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Найти аниме, жанр или настроение..." />
        <button type="button" onClick={()=>setOpen(false)}>esc</button>
      </div>

      <div className="global-search-chips">
        {['лёгкое позитивное','романтика','экшен','психология','короткое','онгоинг'].map(value=><button type="button" key={value} onClick={()=>setQuery(value)}>{value}</button>)}
      </div>

      <div className="global-search-results" aria-live="polite">
        {loading && !results.length ? <div className="global-search-empty">Ищем по всему каталогу…</div> : null}
        {!loading && error && !results.length ? <div className="global-search-empty">{error}</div> : null}
        {results.length ? results.map(item=><Link onClick={()=>setOpen(false)} href={`/anime/${item.slug}`} className="global-search-item" key={item.slug} prefetch={false}>
          <img loading="lazy" decoding="async" width="72" height="102" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/>
          <div><b>{item.title}</b><span>{item.year || '—'} · {item.meta || item.kind || 'Аниме'} · ★ {item.rating || '—'}</span><p>{(item.genres || []).slice(0,3).join(' · ')}</p></div>
        </Link>) : null}
        {!loading && !error && !results.length ? <div className="global-search-empty">Ничего не найдено. Попробуй русское или английское название, жанр или настроение.</div> : null}
      </div>

      <Link onClick={()=>setOpen(false)} href={`/ai?q=${encodeURIComponent(query || 'что посмотреть вечером')}`} className="global-search-ai"><HomeSectionIcon type="ai"/> Подобрать через AI</Link>
    </section>
  </div>
}

export default function GlobalSearchOverlay({ global = false, items = [], className, label }){
  if(global) return <SearchModal/>
  return <SearchTrigger items={items} className={className} label={label}/>
}
