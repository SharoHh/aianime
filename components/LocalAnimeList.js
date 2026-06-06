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
    title:item.title || item.titleRu || item.name || 'Без названия',
    poster:safePoster(item.poster || item.poster_url || item.banner),
    episode,
    progress,
    href:itemHref(item, storageKey),
    meta:history
      ? `Серия ${episode}${item.voice ? ` · ${item.voice}` : ''}${progress ? ` · ${Math.round(progress)}%` : ''}`
      : (item.meta || item.year || item.status || 'В избранном')
  }
}

function formatDate(value){
  if(!value) return '—'
  try{
    return new Date(value).toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' })
  }catch{
    return '—'
  }
}

export default function LocalAnimeList({ storageKey, emptyTitle, emptyText }){
  const [items,setItems] = useState([])
  const isHistory = storageKey === 'anime:history'

  useEffect(()=>{
    const load = () => setItems(readItems(storageKey).map(item => normalizeItem(item, storageKey)).filter(Boolean))
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
    const lastDate = items[0]?.watchedAt || items[0]?.savedAt || null
    return { episodes, voices, lastDate }
  }, [items])

  function clear(){
    clearAnimeData(storageKey)
    setItems([])
    pushToast(isHistory ? 'История очищена' : 'Избранное очищено', 'success')
  }

  function removeItem(item){
    const next = readItems(storageKey).filter(current => current?.slug !== item.slug)
    writeItems(storageKey, next)
    setItems(next.map(value => normalizeItem(value, storageKey)).filter(Boolean))
    pushToast(isHistory ? 'Тайтл убран из истории' : 'Тайтл убран из списка', 'success')
  }

  if(!items.length){
    return <div className="widget local-library-empty">
      <h2>{emptyTitle}</h2>
      <p>{emptyText}</p>
      <Link className="primary" href="/catalog">Открыть каталог</Link>
    </div>
  }

  return <section className="local-library-shell">
    <div className="local-library-summary">
      <div>
        <span>{isHistory ? 'история профиля' : 'избранное профиля'}</span>
        <b>{items.length} {isHistory ? 'тайтлов в истории' : 'тайтлов сохранено'}</b>
      </div>
      <div className="local-library-metrics">
        {isHistory ? <em>{stats.episodes} серий</em> : null}
        {isHistory && stats.voices ? <em>{stats.voices} озвучек</em> : null}
        <em>обновлено {formatDate(stats.lastDate)}</em>
      </div>
      <button type="button" onClick={clear}>Очистить</button>
    </div>

    <div className="catalog-grid local-library-grid">
      {items.map(item => <article className="local-library-card" key={`${item.slug}-${item.episode || 0}-${item.voice || ''}`}>
        <Link className="poster" href={item.href} prefetch={false}>
          <img loading="lazy" decoding="async" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/>
          <div className="rating">{isHistory ? '▶' : '★'} {isHistory ? `сер. ${item.episode}` : (item.rating || '—')}</div>
          <div className="poster-info"><b>{item.title}</b><span>{item.meta}</span></div>
        </Link>
        {isHistory ? <div className="local-library-progress"><i style={{ width:`${Math.max(item.progress || 0, 8)}%` }}/></div> : null}
        <div className="local-library-actions">
          <Link href={item.href} prefetch={false}>{isHistory ? 'Продолжить' : 'Открыть'}</Link>
          <button type="button" onClick={() => removeItem(item)}>Убрать</button>
        </div>
      </article>)}
    </div>
  </section>
}
