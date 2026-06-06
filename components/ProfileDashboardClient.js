'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { clearAnimeData, getFavorites, getHistory, getRatings } from '@/lib/userStorage'
import { pushToast } from '@/components/ToastCenter'

function posterSrc(value){
  const text = String(value || '').trim()
  if(!text) return '/posters/oshi.svg'
  if(text.startsWith('/api/image') || text.startsWith('/posters/') || text.startsWith('/images/') || text.startsWith('/aianime-logo')) return text
  if(/^https?:\/\//i.test(text)) return `/api/image?url=${encodeURIComponent(text)}&fallback=${encodeURIComponent('/posters/oshi.svg')}`
  return text
}

function itemTime(item){
  const raw = item?.watchedAt || item?.savedAt || item?.updatedAt || item?.createdAt || 0
  const time = new Date(raw).getTime()
  return Number.isFinite(time) ? time : 0
}

function sortRecent(items){
  return [...(items || [])].sort((a,b) => itemTime(b) - itemTime(a))
}

function dedupeBySlug(items){
  const map = new Map()
  sortRecent(items).forEach(item => {
    if(item?.slug && !map.has(item.slug)) map.set(item.slug, item)
  })
  return Array.from(map.values())
}

function resumeHref(item){
  if(!item?.slug) return '/catalog'
  const episode = Math.max(1, Number(item.episode || 1) || 1)
  const params = new URLSearchParams({ episode:String(episode), resume:'1' })
  if(item.voice) params.set('voice', item.voice)
  return `/anime/${item.slug}?${params.toString()}#player`
}

function displayDate(value){
  if(!value) return '—'
  try{
    return new Date(value).toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' })
  }catch{
    return '—'
  }
}

function titleFromSlug(slug){
  return String(slug || '').replace(/^\d+-/, '').replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()).slice(0, 54)
}

export default function ProfileDashboardClient(){
  const [favorites,setFavorites] = useState([])
  const [history,setHistory] = useState([])
  const [ratings,setRatings] = useState({})

  function load(){
    setFavorites(dedupeBySlug(getFavorites()))
    setHistory(dedupeBySlug(getHistory()))
    setRatings(getRatings())
  }

  useEffect(()=>{
    load()
    window.addEventListener('storage', load)
    window.addEventListener('anime:user-updated', load)
    window.addEventListener('anime:rating-updated', load)
    return () => {
      window.removeEventListener('storage', load)
      window.removeEventListener('anime:user-updated', load)
      window.removeEventListener('anime:rating-updated', load)
    }
  }, [])

  const titlesBySlug = useMemo(() => {
    const map = new Map()
    ;[...favorites, ...history].forEach(item => {
      if(item?.slug) map.set(item.slug, item.title || item.titleRu || item.name || titleFromSlug(item.slug))
    })
    return map
  }, [favorites, history])

  const ratingEntries = useMemo(() => Object.entries(ratings)
    .filter(([,v]) => Number(v))
    .map(([slug,value]) => ({ slug, value:Number(value), title:titlesBySlug.get(slug) || titleFromSlug(slug) }))
    .sort((a,b)=>Number(b.value)-Number(a.value)), [ratings, titlesBySlug])

  const avg = useMemo(()=>{
    const values = ratingEntries.map(item => Number(item.value)).filter(Boolean)
    if(!values.length) return '—'
    return (values.reduce((a,b)=>a+b,0)/values.length * 2).toFixed(1).replace('.0', '')
  }, [ratingEntries])

  function clearAll(){
    if(!window.confirm('Очистить избранное, историю и оценки?')) return
    clearAnimeData('all')
    load()
    pushToast('Данные профиля очищены', 'success')
  }

  const last = history[0]
  const completed = history.filter(item => Number(item.progress || 0) >= 90).length
  const lastUpdate = last?.watchedAt || favorites[0]?.savedAt || null
  const stats = [
    ['Избранное', favorites.length, '/favorites'],
    ['История', history.length, '/history'],
    ['Оценок', ratingEntries.length, '/profile'],
    ['Средняя', avg, '/profile'],
    ['Досмотрено', completed, '/history'],
  ]

  const activity = [
    ...history.slice(0,3).map(item => ({ type:'history', label:'Смотрел', title:item.title || titleFromSlug(item.slug), href:resumeHref(item), meta:`Серия ${Math.max(1, Number(item.episode || 1) || 1)}${item.voice ? ` · ${item.voice}` : ''}`, date:item.watchedAt })),
    ...favorites.slice(0,3).map(item => ({ type:'favorite', label:'В избранном', title:item.title || titleFromSlug(item.slug), href:`/anime/${item.slug}`, meta:item.meta || item.year || 'Сохранено', date:item.savedAt }))
  ].sort((a,b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()).slice(0,5)

  return <section className="profile-dashboard-suite-v173" aria-label="Сводка профиля">
    <section className="profile-dashboard widget profile-dashboard-v168 profile-dashboard-v173">
      <div className="profile-hero-card profile-hero-card-v173">
        <img src="/posters/oshi.svg" alt="Профиль AIanime"/>
        <div>
          <span>личная библиотека</span>
          <h2>Продолжай с того места, где остановился</h2>
          <p>История, избранное и оценки собраны в одном профиле. Карточки ведут сразу в нужный тайтл, а история — прямо к плееру и последней серии.</p>
          <div className="profile-actions">
            <Link className="primary" href="/catalog">Найти аниме</Link>
            {last ? <Link className="secondary" href={resumeHref(last)} prefetch={false}>Продолжить</Link> : <Link className="secondary" href="/ai">AI-подбор</Link>}
            <button className="secondary" onClick={clearAll}>Очистить</button>
          </div>
        </div>
      </div>
      <div className="profile-stat-grid profile-stat-grid-v168 profile-stat-grid-v173">
        {stats.map(([label,value,href])=><Link href={href} className="profile-big-stat" key={label}><span>{label}</span><b>{value}</b></Link>)}
      </div>
      <div className="profile-freshness-v173">Последнее обновление: <b>{displayDate(lastUpdate)}</b></div>
    </section>

    <div className="profile-dashboard-columns-v168 profile-dashboard-columns-v173">
      <section>
        <div className="section-title"><h2><span>◷</span>Продолжить просмотр</h2><Link href="/history">История ›</Link></div>
        {history.length ? <div className="continue-row profile-continue-row-v168 profile-continue-row-v173">
          {history.slice(0,4).map(item => {
            const episode = Math.max(1, Number(item.episode || 1) || 1)
            const progress = Math.max(Number(item.progress || 0) || 0, 8)
            return <Link className="continue-card" href={resumeHref(item)} key={`${item.slug}-${episode}-${item.voice || ''}`} prefetch={false}>
              <img loading="lazy" decoding="async" src={posterSrc(item.banner || item.poster)} alt={item.title ? `Обложка аниме ${item.title}` : 'Обложка аниме'}/>
              <div className="play">▶</div>
              <div className="continue-info"><b>{item.title || titleFromSlug(item.slug)}</b><span>Серия {episode}{item.voice ? ` · ${item.voice}` : ''}</span><div className="bar"><i style={{width:`${progress}%`}}/></div></div>
              <em>{Math.round(progress)}%</em>
            </Link>
          })}
        </div> : <div className="empty-state">История пока пустая. Открой любой тайтл и нажми “Смотреть”.</div>}
      </section>

      <section className="profile-mini-panel-v168 profile-mini-panel-v173">
        <div className="section-title"><h2><span>★</span>Оценки</h2><span>{ratingEntries.length}</span></div>
        {ratingEntries.length ? <div className="profile-rating-list-v168 profile-rating-list-v173">
          {ratingEntries.slice(0,6).map(item => <Link href={`/anime/${item.slug}`} key={item.slug} prefetch={false}>
            <span>{item.title}</span>
            <b>{item.value * 2}/10</b>
          </Link>)}
        </div> : <div className="empty-state">Оценок пока нет.</div>}
      </section>
    </div>

    <div className="profile-dashboard-columns-v173 profile-dashboard-bottom-v173">
      <section>
        <div className="section-title"><h2><span>♡</span>Избранное</h2><Link href="/favorites">Все ›</Link></div>
        {favorites.length ? <div className="poster-row profile-favorites-row-v173">
          {favorites.slice(0,5).map(item=><Link className="poster" href={`/anime/${item.slug}`} key={item.slug} prefetch={false}>
            <img loading="lazy" decoding="async" width="320" height="480" src={posterSrc(item.poster)} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/><div className="rating">★ {item.rating || '—'}</div><div className="poster-info"><b>{item.title || titleFromSlug(item.slug)}</b><span>{item.meta || 'В избранном'}</span></div>
          </Link>)}
        </div> : <div className="empty-state">Избранное пустое. Добавляй тайтлы со страницы аниме.</div>}
      </section>

      <section className="profile-mini-panel-v168 profile-mini-panel-v173">
        <div className="section-title"><h2><span>•</span>Последние действия</h2><span>{activity.length}</span></div>
        {activity.length ? <div className="profile-activity-list-v173">
          {activity.map((item, index) => <Link href={item.href} key={`${item.type}-${item.href}-${index}`} prefetch={false}>
            <em>{item.label}</em>
            <b>{item.title}</b>
            <span>{item.meta} · {displayDate(item.date)}</span>
          </Link>)}
        </div> : <div className="empty-state">Пока нет действий.</div>}
      </section>
    </div>
  </section>
}
