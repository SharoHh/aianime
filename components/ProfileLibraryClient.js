'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { LIBRARY_STATUSES, getFavorites, getLibrary, libraryStatusLabel, setLibraryStatus } from '@/lib/userStorage'
import { pushToast } from '@/components/ToastCenter'
import { isUsableAnimePoster, versionAnimePosterUrl } from '@/lib/animeQuality'

const TAB_LABELS = {
  all:'Все',
  watching:'Смотрю',
  planned:'В планах',
  completed:'Просмотрено',
  dropped:'Брошено',
  favorites:'Любимые'
}

const TAB_ORDER = ['all', 'watching', 'planned', 'completed', 'dropped', 'favorites']

function posterSrc(value){
  const text = String(value || '').trim()
  if(!text || !isUsableAnimePoster(text)) return ''
  if(text.startsWith('/')) return versionAnimePosterUrl(text)
  return versionAnimePosterUrl(`/api/image?url=${encodeURIComponent(text)}&fallback=${encodeURIComponent('/posters/magic2.svg')}`)
}

function normalizeDate(value){
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

function formatDate(value){
  if(!value) return '—'
  try{ return new Date(value).toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' }) }catch{ return '—' }
}

function mergeRows(library, favorites){
  const map = new Map()
  Object.values(library || {}).forEach(item => {
    if(!item?.slug || !item?.status) return
    map.set(item.slug, {
      ...item,
      source:'library',
      title:item.title || item.slug,
      poster:posterSrc(item.poster || item.banner),
      status:item.status,
      updatedAt:item.updatedAt || item.savedAt || null,
      favorite:false
    })
  })
  ;(favorites || []).forEach(item => {
    if(!item?.slug) return
    const previous = map.get(item.slug)
    map.set(item.slug, {
      ...(previous || {}),
      ...item,
      source: previous ? previous.source : 'favorites',
      title: previous?.title || item.title || item.slug,
      poster:posterSrc(previous?.poster || item.poster || item.banner),
      status: previous?.status || '',
      updatedAt: previous?.updatedAt || item.savedAt || null,
      favorite:true
    })
  })
  return Array.from(map.values()).filter(item => Boolean(item.poster)).sort((a,b) => normalizeDate(b.updatedAt) - normalizeDate(a.updatedAt))
}

export default function ProfileLibraryClient(){
  const [rows,setRows] = useState([])
  const [tab,setTab] = useState('all')
  const [query,setQuery] = useState('')

  function load(){
    setRows(mergeRows(getLibrary(), getFavorites()))
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
    const next = { all:rows.length, favorites:rows.filter(row => row.favorite).length }
    LIBRARY_STATUSES.forEach(status => { next[status.value] = rows.filter(row => row.status === status.value).length })
    return next
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(row => {
      if(tab === 'favorites' && !row.favorite) return false
      if(tab !== 'all' && tab !== 'favorites' && row.status !== tab) return false
      if(!q) return true
      return [row.title, row.slug, row.meta, libraryStatusLabel(row.status)].filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [rows, tab, query])

  function remove(row){
    if(!row?.slug) return
    setLibraryStatus(row, '')
    load()
    pushToast('Статус тайтла убран из библиотеки', 'success')
  }

  return <section id="profile-library" className="profile-library-board widget" aria-label="Моя библиотека">
    <div className="profile-library-head">
      <div>
        <span>личная библиотека</span>
        <h2>Моя библиотека</h2>
        <p>Статусы тайтлов теперь живут в профиле: смотришь, планируешь, досмотрел или бросил.</p>
      </div>
      <Link href="/catalog" prefetch={false}>Добавить из каталога</Link>
    </div>

    <div className="profile-library-tabs" role="tablist" aria-label="Фильтр библиотеки">
      {TAB_ORDER.map(key => <button
        type="button"
        key={key}
        className={tab === key ? 'active' : ''}
        onClick={() => setTab(key)}
      ><span>{TAB_LABELS[key]}</span><b>{counts[key] || 0}</b></button>)}
    </div>

    <div className="profile-library-tools">
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Поиск по библиотеке" />
      <span>{filtered.length} из {rows.length}</span>
    </div>

    {!filtered.length ? <div className="profile-library-empty">
      <b>{rows.length ? 'Ничего не найдено' : 'Библиотека пока пустая'}</b>
      <p>{rows.length ? 'Попробуй другой статус или запрос.' : 'Открой страницу тайтла и выбери статус под постером.'}</p>
      <Link href="/catalog" prefetch={false}>Перейти в каталог</Link>
    </div> : <div className="profile-library-grid">
      {filtered.map(row => <article className="profile-library-card" key={row.slug}>
        <Link className="profile-library-poster" href={`/anime/${row.slug}`} prefetch={false}>
          <img loading="lazy" decoding="async" src={row.poster} alt={row.title ? `Постер аниме ${row.title}` : 'Постер аниме'}/>
        </Link>
        <div className="profile-library-card-body">
          <div>
            <span>{row.status ? libraryStatusLabel(row.status) : row.favorite ? 'Любимое' : 'В библиотеке'}</span>
            <h3>{row.title}</h3>
            <p>{row.meta || `обновлено ${formatDate(row.updatedAt)}`}</p>
          </div>
          <div className="profile-library-actions">
            <Link href={`/anime/${row.slug}`} prefetch={false}>Открыть</Link>
            {row.status ? <button type="button" onClick={() => remove(row)}>Убрать статус</button> : null}
          </div>
        </div>
      </article>)}
    </div>}
  </section>
}
