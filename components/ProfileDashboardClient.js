'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getFavorites, getHistory, getRatings, writeJson } from '@/lib/userStorage'

export default function ProfileDashboardClient(){
  const [favorites,setFavorites] = useState([])
  const [history,setHistory] = useState([])
  const [ratings,setRatings] = useState({})

  function load(){
    setFavorites(getFavorites())
    setHistory(getHistory())
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

  const ratingEntries = useMemo(() => Object.entries(ratings).filter(([,v]) => Number(v)), [ratings])
  const avg = useMemo(()=>{
    const values = ratingEntries.map(([,v]) => Number(v)).filter(Boolean)
    if(!values.length) return '—'
    return (values.reduce((a,b)=>a+b,0)/values.length).toFixed(1)
  }, [ratingEntries])

  function clearAll(){
    writeJson('anime:favorites', [])
    writeJson('anime:history', [])
    writeJson('anime:ratings', {})
    load()
  }

  const last = history[0]
  const stats = [
    ['Избранное', favorites.length, '/favorites'],
    ['История', history.length, '/history'],
    ['Оценок', ratingEntries.length, '/profile'],
    ['Средняя', avg, '/profile'],
  ]

  return <>
    <section className="profile-dashboard widget">
      <div className="profile-hero-card">
        <img src="/posters/oshi.svg" alt="Haruno"/>
        <div>
          <span>локальный профиль</span>
          <h2>Haruno</h2>
          <p>Твои избранные тайтлы, история просмотра и оценки хранятся на этом устройстве. Позже можно подключить авторизацию и синхронизацию между устройствами.</p>
          <div className="profile-actions">
            <Link className="primary" href="/catalog">Найти аниме</Link>
            {last ? <Link className="secondary" href={`/anime/${last.slug}#player`}>Продолжить</Link> : <Link className="secondary" href="/ai">AI-подбор</Link>}
            <button className="secondary" onClick={clearAll}>Очистить</button>
          </div>
        </div>
      </div>
      <div className="profile-stat-grid">
        {stats.map(([label,value,href])=><Link href={href} className="profile-big-stat" key={label}><span>{label}</span><b>{value}</b></Link>)}
      </div>
    </section>

    <div className="section-title"><h2><span>◷</span>Продолжить просмотр</h2><Link href="/history">История ›</Link></div>
    {history.length ? <div className="continue-row">
      {history.slice(0,4).map(a=><Link className="continue-card" href={`/anime/${a.slug}#player`} key={a.slug}>
        <img loading="lazy" decoding="async" src={a.banner || a.poster}/>
        <div className="play">▶</div>
        <div className="continue-info"><b>{a.title}</b><span>Серия {a.episode || 1}</span><div className="bar"><i style={{width:(a.progress || 12)+'%'}}/></div></div>
        <em>{a.progress || 12}%</em>
      </Link>)}
    </div> : <div className="empty-state">История пока пустая. Открой любой тайтл и нажми “Смотреть”.</div>}

    <div className="section-title"><h2><span>♡</span>Избранное</h2><Link href="/favorites">Все ›</Link></div>
    {favorites.length ? <div className="poster-row">
      {favorites.slice(0,5).map(a=><Link className="poster" href={`/anime/${a.slug}`} key={a.slug}>
        <img loading="lazy" decoding="async" src={a.poster}/><div className="rating">★ {a.rating || '—'}</div><div className="poster-info"><b>{a.title}</b><span>{a.meta}</span></div>
      </Link>)}
    </div> : <div className="empty-state">Избранное пустое. Добавляй тайтлы со страницы аниме.</div>}
  </>
}
