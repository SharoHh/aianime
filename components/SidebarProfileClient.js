'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const defaults = {
  name: 'Haruno',
  level: 'Уровень 12',
  avatar: '/posters/oshi.svg',
  cover: ''
}

const obsoleteCovers = new Set([
  '/images/profile-sidebar-bg-960.webp',
  '/images/profile-sidebar-bg.webp'
])

function cleanCover(value){
  const text = String(value || '').trim()
  if(!text || obsoleteCovers.has(text)) return ''
  return text
}

function readListCount(key){
  try{
    const parsed = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed.length : 0
  }catch{
    return 0
  }
}

function readProfile(){
  try{
    const saved = JSON.parse(localStorage.getItem('anime:profile') || '{}')
    return {
      ...defaults,
      ...saved,
      cover:cleanCover(saved?.cover)
    }
  }catch{
    return defaults
  }
}

export default function SidebarProfileClient(){
  const [state,setState] = useState(null)
  const [coverFailed,setCoverFailed] = useState(false)

  useEffect(()=>{
    const update = () => {
      const profile = readProfile()
      setCoverFailed(false)
      setState({
        profile,
        favorites:readListCount('anime:favorites'),
        history:readListCount('anime:history')
      })
    }
    update()
    window.addEventListener('storage', update)
    window.addEventListener('anime:user-updated', update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener('anime:user-updated', update)
    }
  }, [])

  if(!state){
    return <div className="sidebar-profile-card sidebar-profile-card-loading" aria-hidden="true"/>
  }

  const { profile, favorites, history } = state
  const cover = cleanCover(profile.cover)
  const hasCover = Boolean(cover) && !coverFailed

  return <Link href="/profile" className={`sidebar-profile-card sidebar-profile-card-v253 ${hasCover ? 'has-cover' : 'is-coverless'}`}>
    {hasCover ? <img className="sidebar-profile-cover" src={cover} alt="" onError={()=>setCoverFailed(true)}/> : null}

    <div className="sidebar-profile-art-v253" aria-hidden="true">
      <span className="sidebar-profile-orb-v253 orb-one"/>
      <span className="sidebar-profile-orb-v253 orb-two"/>
      <span className="sidebar-profile-spark-v253 spark-one">✦</span>
      <span className="sidebar-profile-spark-v253 spark-two">✧</span>
      <b>AI</b>
      <em>твой аниме-мир</em>
    </div>

    <div className="sidebar-profile-top">
      <span className="sidebar-profile-avatar-shell-v253">
        <img className="sidebar-profile-avatar" src={profile.avatar || defaults.avatar} alt="Аватар" onError={e=>{ e.currentTarget.style.display = 'none' }}/>
      </span>
      <div>
        <b>{profile.name || defaults.name}</b>
        <span>{profile.level || defaults.level}</span>
      </div>
      <i>›</i>
    </div>

    <div className="sidebar-profile-meta-v253">
      <span><b>{favorites}</b> в избранном</span>
      <span><b>{history}</b> в истории</span>
      <strong>Открыть профиль</strong>
    </div>
  </Link>
}
