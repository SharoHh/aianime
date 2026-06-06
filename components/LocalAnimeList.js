'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { clearAnimeData } from '@/lib/userStorage'
import { pushToast } from '@/components/ToastCenter'

function safePoster(raw){
  const text = String(raw || '').trim()
  if(!text) return '/posters/magic2.svg'
  if(text.startsWith('/api/image') || text.startsWith('/posters/') || text.startsWith('/images/') || text.startsWith('/aianime-logo')) return text
  if(text.startsWith('/')) return text
  if(/^https?:\/\//i.test(text)) return `/api/image?url=${encodeURIComponent(text)}&fallback=${encodeURIComponent('/posters/magic2.svg')}`
  return '/posters/magic2.svg'
}

function readItems(storageKey){
  try{ return JSON.parse(localStorage.getItem(storageKey) || '[]') }catch{ return [] }
}

function writeItems(storageKey, items){
  try{ localStorage.setItem(storageKey, JSON.stringify(items || [])) }catch{}
  try{ window.dispatchEvent(new Event('anime:user-updated')) }catch{}
}

function itemEpisode(item){
  return Math.max(1, Number(item?.episode || 1) || 1)
}

function itemProgress(item){
  return Math.max(0, Math.min(100, Number(item?.progress || 0) || 0))
}

function itemDate(item){
  const raw = item?.watchedAt || item?.savedAt || item?.updatedAt || item?.createdAt || 0
  const time = new Date(raw).getTime()
  return Number.isFinite(time) ? time : 0
}

function sortRecent(items){
  return [...(items || [])].sort((a,b) => itemDate(b) - itemDate(a))
}

function itemHref(item, storageKey){
  if(!item?.slug) return '/catalog'
  if(storageKey === 'anime:history'){
    const episode = itemEpisode(item)
    const params = new URLSearchParams({ episode:String(episode), resume:'1' })
    if(item?.voice) params.set('voice', item.voice)
    return `/anime/${item.slug}?${params.toString()}#player`
  }
  return `/anime/${item.slug}`
}

function normalizeItem(item, storageKey){
  if(!item?.slug) return null
  const history = storageKey === 'anime:history'
  const episode = itemEpisode(item)
  const progress = itemProgress(item)
  return {
    ...item,
    title:item.title || item.titleRu || item.name || String(item.slug).replace(/^\d+-/, '').replace(/-/g, ' '),
    poster:safePoster(item.poster || item.poster_url || item.banner),
    episode,
    progress,
    href:itemHref(item, storageKey),
    date:item.watchedAt || item.savedAt || null,
    meta:history
      ? `Серия ${episode}${item.voice ? ` · ${item.voice}` : ''}${progress ? ` · ${Math.round(progress)}%` : ''}`
      : (item.meta || item.year || item.status || 'В избранном')
  }
}

function normalizeList(rawItems, storageKey){
  const map = new Map()
  sortRecent(rawItems).forEach(item => {
    if(!item?.slug) return
    const key = storageKey === 'anime:history' ? item.slug : item.slug
    if(!map.has(key)) map.set(key, item)
  })
  return Array.from(map.values()).map(item => normalizeItem(item, storageKey)).filter(Boolean)
}

function formatDate(value){
  if(!value) return '—'
  try{
    return new Date(value).toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' })
  }catch{
    return '—'
  }
}

function sortItems(items, sort){
  const list = [...items]
  if(sort === 'title') return list.sort((a,b) => String(a.title || '').localeCompare(String(b.title || ''), 'ru'))
  if(sort === 'progress') return list.sort((a,b) => Number(b.progress || 0) - Number(a.progress || 0))
  return list.sort((a,b) => itemDate(b) - itemDate(a))
}

export default function LocalAnimeList({ storageKey, emptyTitle, emptyText }){
  const [items,setItems] = useState([])
  const [query,setQuery] = useState('')
  const [sort,setSort] = useState('recent')
  const isHistory = storageKey === 'anime:history'

  useEffect(()=>{
    const load = () => setItems(normalizeList(readItems(storageKey), storageKey))
    load()
    window.addEventListener('storage', load)
    window.addEventListener('anime:user-updated', load)
    return () => {
      window.removeEventListener('storage', load)
      window.removeEventListener('anime:user-updated', load)
    }
  }, [storageKey])

  const stats = useMemo(() => {
    const episodes = new Set(items.map(item => `${item.slug}:${item.episode || 1}`)).size
    const voices = new Set(items.map(item => item.voice).filter(Boolean)).size
    const lastDate = items[0]?.watchedAt || items[0]?.savedAt || items[0]?.date || null
    const completed = items.filter(item => Number(item.progress || 0) >= 90).length
    return { episodes, voices, lastDate, completed }
  }, [items])

  const visibleItems = useMemo(() => {
    const clean = query.trim().toLowerCase()
    const filtered = clean ? items.filter(item => [item.title, item.slug, item.voice, item.meta].some(value => String(value || '').toLowerCase().includes(clean))) : items
    return sortItems(filtered, sort)
  }, [items, query, sort])

  function clear(){
    clearAnimeData(storageKey)
    setItems([])
    pushToast(isHistory ? 'История очищена' : 'Избранное очищено', 'success')
  }

  function removeItem(item){
    const next = readItems(storageKey).filter(current => current?.slug !== item.slug)
    writeItems(storageKey, next)
    setItems(normalizeList(next, storageKey))
    pushToast(isHistory ? 'Тайтл убран из истории' : 'Тайтл убран из списка', 'success')
  }

  if(!items.length){
    return <div className="widget local-library-empty local-library-empty-v173">
      <h2>{emptyTitle}</h2>
      <p>{emptyText}</p>
      <Link className="primary" href="/catalog">Открыть каталог</Link>
    </div>
  }

  return <section className="local-library-shell local-library-shell-v173">
    <div className="local-library-summary local-library-summary-v173">
      <div>
        <span>{isHistory ? 'история профиля' : 'избранное профиля'}</span>
        <b>{items.length} {isHistory ? 'тайтлов в истории' : 'тайтлов сохранено'}</b>
      </div>
      <div className="local-library-metrics">
        {isHistory ? <em>{stats.episodes} серий</em> : null}
        {isHistory ? <em>{stats.completed} досмотрено</em> : null}
        {isHistory && stats.voices ? <em>{stats.voices} озвучек</em> : null}
        <em>обновлено {formatDate(stats.lastDate)}</em>
      </div>
      <button type="button" onClick={clear}>Очистить</button>
    </div>

    <div className="local-library-toolbar-v173">
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder={isHistory ? 'Поиск по истории, серии или озвучке' : 'Поиск по избранному'}/>
      <select value={sort} onChange={event => setSort(event.target.value)} aria-label="Сортировка">
        <option value="recent">Сначала новые</option>
        <option value="title">По названию</option>
        {isHistory ? <option value="progress">По прогрессу</option> : null}
      </select>
    </div>

    {!visibleItems.length ? <div className="empty-state local-library-filter-empty-v173">По этому запросу ничего нет.</div> : <div className="catalog-grid local-library-grid local-library-grid-v173">
      {visibleItems.map(item => <article className="local-library-card local-library-card-v173" key={`${item.slug}-${item.episode || 0}-${item.voice || ''}`}>
        <Link className="poster" href={item.href} prefetch={false}>
          <img loading="lazy" decoding="async" width="320" height="480" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/>
          <div className="rating">{isHistory ? '▶' : '★'} {isHistory ? `сер. ${item.episode}` : (item.rating || '—')}</div>
          <div className="poster-info"><b>{item.title}</b><span>{item.meta}</span></div>
        </Link>
        {isHistory ? <div className="local-library-progress"><i style={{ width:`${Math.max(item.progress || 0, 8)}%` }}/></div> : null}
        <div className="local-library-card-meta-v173">
          <span>{formatDate(item.date)}</span>
          {isHistory && item.voice ? <span>{item.voice}</span> : null}
        </div>
        <div className="local-library-actions">
          <Link href={item.href} prefetch={false}>{isHistory ? 'Продолжить' : 'Открыть'}</Link>
          <button type="button" onClick={() => removeItem(item)}>Убрать</button>
        </div>
      </article>)}
    </div>}
  </section>
}
