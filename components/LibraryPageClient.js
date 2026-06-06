'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { LIBRARY_STATUSES, getLibrary, libraryStatusLabel, setLibraryStatus } from '@/lib/userStorage'
import { pushToast } from '@/components/ToastCenter'

function posterSrc(value){
  const text = String(value || '').trim()
  if(!text) return '/posters/oshi.svg'
  if(text.startsWith('/api/image') || text.startsWith('/posters/') || text.startsWith('/images/') || text.startsWith('/aianime-logo')) return text
  if(/^https?:\/\//i.test(text)) return `/api/image?url=${encodeURIComponent(text)}&fallback=${encodeURIComponent('/posters/oshi.svg')}`
  return text
}

function normalizeLibraryRows(data){
  return Object.values(data || {})
    .filter(item => item?.slug && item?.status)
    .map(item => ({
      ...item,
      title:item.title || item.slug,
      poster:posterSrc(item.poster || item.banner),
      updatedAt:item.updatedAt || item.savedAt || null
    }))
    .sort((a,b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
}

function formatDate(value){
  if(!value) return '—'
  try{ return new Date(value).toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' }) }catch{ return '—' }
}

export default function LibraryPageClient(){
  const [rows,setRows] = useState([])
  const [filter,setFilter] = useState('all')
  const [query,setQuery] = useState('')

  function load(){
    setRows(normalizeLibraryRows(getLibrary()))
  }

  useEffect(()=>{
    load()
    window.addEventListener('storage', load)
    window.addEventListener('anime:user-updated', load)
    window.addEventListener('anime:library-updated', load)
    return () => {
      window.removeEventListener('storage', load)
      window.removeEventListener('anime:user-updated', load)
      window.removeEventListener('anime:library-updated', load)
    }
  }, [])

  const counts = useMemo(() => {
    const next = { all:rows.length }
    LIBRARY_STATUSES.forEach(status => { next[status.value] = rows.filter(row => row.status === status.value).length })
    return next
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(row => {
      if(filter !== 'all' && row.status !== filter) return false
      if(!q) return true
      return [row.title, row.slug, row.meta, libraryStatusLabel(row.status)].filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [rows, filter, query])

  function remove(row){
    setLibraryStatus(row, '')
    load()
    pushToast('Тайтл убран из библиотеки', 'success')
  }

  return <section className="library-page-shell">
    <div className="library-toolbar widget">
      <div>
        <span>личный список</span>
        <h2>Моя библиотека</h2>
        <p>Разложи тайтлы по статусам: что смотришь, что отложил, что уже закрыл или бросил.</p>
      </div>
      <Link className="secondary" href="/catalog">Добавить из каталога</Link>
    </div>

    <div className="library-tabs" role="tablist" aria-label="Фильтр библиотеки">
      <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Все <b>{counts.all || 0}</b></button>
      {LIBRARY_STATUSES.map(status => <button type="button" key={status.value} className={filter === status.value ? 'active' : ''} onClick={() => setFilter(status.value)}>{status.label} <b>{counts[status.value] || 0}</b></button>)}
    </div>

    <input className="library-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Поиск по библиотеке" />

    {!filtered.length ? <div className="widget local-library-empty">
      <h2>{rows.length ? 'Ничего не найдено' : 'Библиотека пока пустая'}</h2>
      <p>{rows.length ? 'Попробуй другой запрос или статус.' : 'Открой страницу тайтла и выбери статус: смотрю, буду смотреть, просмотрено или брошено.'}</p>
      <Link className="primary" href="/catalog">Открыть каталог</Link>
    </div> : <div className="catalog-grid local-library-grid library-grid">
      {filtered.map(row => <article className="local-library-card library-card" key={row.slug}>
        <Link className="poster" href={`/anime/${row.slug}`} prefetch={false}>
          <img loading="lazy" decoding="async" src={row.poster} alt={row.title ? `Постер аниме ${row.title}` : 'Постер аниме'}/>
          <div className="rating">{libraryStatusLabel(row.status)}</div>
          <div className="poster-info"><b>{row.title}</b><span>{row.meta || `обновлено ${formatDate(row.updatedAt)}`}</span></div>
        </Link>
        <div className="local-library-actions">
          <Link href={`/anime/${row.slug}`} prefetch={false}>Открыть</Link>
          <button type="button" onClick={() => remove(row)}>Убрать</button>
        </div>
      </article>)}
    </div>}
  </section>
}
