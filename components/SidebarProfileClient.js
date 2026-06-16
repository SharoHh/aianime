'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const defaults = {
  name: 'Haruno',
  level: 'Уровень 12',
  avatar: '/posters/oshi.svg',
  cover: '/images/profile-sidebar-bg-960.webp'
}

function readProfile(){
  try{
    return { ...defaults, ...JSON.parse(localStorage.getItem('anime:profile') || '{}') }
  }catch{
    return defaults
  }
}

export default function SidebarProfileClient(){
  const [profile,setProfile] = useState(null)

  useEffect(()=>{
    const update = () => setProfile(readProfile())
    update()
    window.addEventListener('storage', update)
    window.addEventListener('anime:user-updated', update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener('anime:user-updated', update)
    }
  }, [])

  if(!profile){
    return <div className="sidebar-profile-card sidebar-profile-card-loading" aria-hidden="true"/>
  }

  return <Link href="/profile" className="sidebar-profile-card">
    <div className="sidebar-profile-top">
      <img className="sidebar-profile-avatar" src={profile.avatar || defaults.avatar} alt="Аватар"/>
      <div>
        <b>{profile.name || defaults.name}</b>
        <span>{profile.level || defaults.level}</span>
      </div>
      <i>›</i>
    </div>
    <img className="sidebar-profile-cover" src={profile.cover || defaults.cover} alt="Профиль"/>
  </Link>
}
