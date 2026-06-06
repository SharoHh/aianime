'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

function readJson(key){
  try{ return JSON.parse(localStorage.getItem(key) || '[]') }catch{ return [] }
}

export default function MiniProfileClient(){
  const [stats, setStats] = useState({ favorites:0, history:0, ratings:0 })

  useEffect(() => {
    const update = () => setStats({
      favorites: readJson('anime:favorites').length,
      history: readJson('anime:history').length,
      ratings: Object.keys(readJson('anime:ratings') || {}).length,
    })
    update()
    window.addEventListener('storage', update)
    window.addEventListener('anime:user-updated', update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener('anime:user-updated', update)
    }
  }, [])

  return <div className="widget profile-widget">
    <div className="widget-head"><h3>Haruno</h3><Link href="/profile">Профиль ›</Link></div>
    <Link className="profile-mini" href="/profile">
      <img src="/posters/oshi.svg" alt="Haruno"/>
      <div><b>Haruno</b><span>Локальный профиль</span></div>
    </Link>
    <div className="profile-stats">
      <Link href="/favorites"><b>{stats.favorites}</b><span>Избранное</span></Link>
      <Link href="/history"><b>{stats.history}</b><span>История</span></Link>
      <Link href="/profile"><b>{stats.ratings}</b><span>Оценки</span></Link>
    </div>
  </div>
}
