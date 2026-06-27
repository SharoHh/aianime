'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { clearAnimeData, getFavorites, getHistory, getRatings } from '@/lib/userStorage'
import { pushToast } from '@/components/ToastCenter'
import { isUsableAnimePoster, versionAnimePosterUrl } from '@/lib/animeQuality'

function posterSrc(value){
  const text = String(value || '').trim()
  if(!text || !isUsableAnimePoster(text)) return ''
  if(text.startsWith('/')) return versionAnimePosterUrl(text)
  return versionAnimePosterUrl(`/api/image?url=${encodeURIComponent(text)}&fallback=${encodeURIComponent('/posters/magic2.svg')}`)
}

function resumeHref(item){
  if(!item?.slug) return '/catalog'
  const episode = Math.max(1, Number(item.episode || 1) || 1)
  const params = new URLSearchParams({ episode:String(episode), resume:'1' })
  if(item.voice) params.set('voice', item.voice)
  return `/anime/${item.slug}?${params.toString()}#player`
}

export default function ProfileDashboardClient(){
  const [favorites,setFavorites] = useState([])
  const [history,setHistory] = useState([])
  const [ratings,setRatings] = useState({})

  function load(){
    setFavorites(getFavorites().filter(item => isUsableAnimePoster(item?.poster || item?.banner)))
    setHistory(getHistory().filter(item => isUsableAnimePoster(item?.banner || item?.poster)))
    setRatings(getRatings())
  }

  useEffect(()=>{
    load()
    window.addEventListener('storage', load)
    window.addEventListener('anime:user-updated', load)
    return () => {
      window.removeEventListener('storage', load)
      window.removeEventListener('anime:user-updated', load)
    }
  }, [])

  const ratingEntries = useMemo(() => Object.entries(ratings).filter(([,v]) => Number(v)).sort((a,b)=>Number(b[1])-Number(a[1])), [ratings])
  const avg = useMemo(()=>{
    const values = ratingEntries.map(([,v]) => Number(v)).filter(Boolean)
    if(!values.length) return '—'
    return (values.reduce((a,b)=>a+b,0)/values.length).toFixed(1)
  }, [ratingEntries])

  function clearAll(){
    if(!window.confirm('Очистить избранное, историю и оценки?')) return
    clearAnimeData('all')
    load()
    pushToast('Данные профиля очищены', 'success')
  }

  const last = history[0]
  const completed = history.filter(item => Number(item.progress || 0) >= 90).length
  const stats = [
    ['Избранное', favorites.length, '/favorites'],
    ['История', history.length, '/history'],
    ['Оценок', ratingEntries.length, '/profile'],
    ['Средняя', avg, '/profile'],
    ['Досмотрено', completed, '/history'],
  ]

  return <>
    <section className="profile-dashboard widget profile-dashboard-v168">
      <div className="profile-hero-card">
        <img src="/posters/oshi.svg" alt="Профиль AIanime"/>
        <div>
          <span>профиль аккаунта</span>
          <h2>Твои данные</h2>
          <p>Избранное, история, оценки и продолжение просмотра собраны в одном месте. Если аккаунт подключён, данные синхронизируются через Supabase.</p>
          <div className="profile-actions">
            <Link className="primary" href="/catalog">Найти аниме</Link>
            {last ? <Link className="secondary" href={resumeHref(last)} prefetch={false}>Продолжить</Link> : <Link className="secondary" href="/ai">AI-подбор</Link>}
            <button className="secondary" onClick={clearAll}>Очистить</button>
          </div>
        </div>
      </div>
      <div className="profile-stat-grid profile-stat-grid-v168">
        {stats.map(([label,value,href])=><Link href={href} className="profile-big-stat" key={label}><span>{label}</span><b>{value}</b></Link>)}
      </div>
    </section>

    <div className="profile-dashboard-columns-v168">
      <section>
        <div className="section-title"><h2><span>◷</span>Продолжить просмотр</h2><Link href="/history">История ›</Link></div>
        {history.length ? <div className="continue-row profile-continue-row-v168">
          {history.slice(0,4).map(item => {
            const episode = Math.max(1, Number(item.episode || 1) || 1)
            const progress = Math.max(Number(item.progress || 0) || 0, 8)
            return <Link className="continue-card" href={resumeHref(item)} key={`${item.slug}-${episode}-${item.voice || ''}`} prefetch={false}>
              <img loading="lazy" decoding="async" src={posterSrc(item.banner || item.poster)} alt={item.title ? `Обложка аниме ${item.title}` : 'Обложка аниме'}/>
              <div className="play">▶</div>
              <div className="continue-info"><b>{item.title}</b><span>Серия {episode}{item.voice ? ` · ${item.voice}` : ''}</span><div className="bar"><i style={{width:`${progress}%`}}/></div></div>
              <em>{Math.round(progress)}%</em>
            </Link>
          })}
        </div> : <div className="empty-state">История пока пустая. Открой любой тайтл и нажми “Смотреть”.</div>}
      </section>

      <section className="profile-mini-panel-v168">
        <div className="section-title"><h2><span>★</span>Оценки</h2><span>{ratingEntries.length}</span></div>
        {ratingEntries.length ? <div className="profile-rating-list-v168">
          {ratingEntries.slice(0,6).map(([slug,value]) => <Link href={`/anime/${slug}`} key={slug} prefetch={false}>
            <span>{slug.replace(/-/g, ' ').slice(0, 46)}</span>
            <b>{value}/5</b>
          </Link>)}
        </div> : <div className="empty-state">Оценок пока нет.</div>}
      </section>
    </div>

    <div className="section-title"><h2><span>♡</span>Избранное</h2><Link href="/favorites">Все ›</Link></div>
    {favorites.length ? <div className="poster-row">
      {favorites.slice(0,5).map(item=><Link className="poster" href={`/anime/${item.slug}`} key={item.slug} prefetch={false}>
        <img loading="lazy" decoding="async" width="320" height="480" src={posterSrc(item.poster)} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/><div className="rating">★ {item.rating || '—'}</div><div className="poster-info"><b>{item.title}</b><span>{item.meta}</span></div>
      </Link>)}
    </div> : <div className="empty-state">Избранное пустое. Добавляй тайтлы со страницы аниме.</div>}
  </>
}
