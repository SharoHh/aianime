'use client'

// AIanime v131: settings page/link removed; profile is the single account hub.

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { readStoredProfile, useAuthState } from '@/components/AuthStateClient'

function Icon({ type }){
  const common = {
    viewBox:'0 0 24 24',
    'aria-hidden':'true',
    className:'sidebar-svg-icon',
    fill:'none',
    stroke:'currentColor',
    strokeWidth:'2',
    strokeLinecap:'round',
    strokeLinejoin:'round',
    vectorEffect:'non-scaling-stroke',
    preserveAspectRatio:'xMidYMid meet'
  }

  if(type === 'login') return <svg {...common}><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20H14"/></svg>
  return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.6-4 13.4-4 15 0"/></svg>
}

export default function SidebarAccountClient(){
  const { loading, configured, user } = useAuthState()
  const [profile,setProfile] = useState(null)

  useEffect(()=>{
    if(!user){
      setProfile(null)
      return undefined
    }

    const update = () => setProfile(readStoredProfile(user))
    update()
    window.addEventListener('storage', update)
    window.addEventListener('anime:user-updated', update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener('anime:user-updated', update)
    }
  }, [user])

  if(loading){
    return <div className="sidebar-account-loading" aria-hidden="true" />
  }

  if(!configured || !user){
    return <>
      <div className="sidebar-separator"/>
      <Link className="nav" href="/auth"><span className="nav-icon"><Icon type="login"/></span>Войти</Link>
    </>
  }

  const safeProfile = profile || readStoredProfile(user)

  return <>
    <div className="sidebar-separator"/>
    <Link className="nav" href="/profile"><span className="nav-icon"><Icon type="profile"/></span>Профиль</Link>
    <Link
      href="/profile"
      className="sidebar-profile-card sidebar-profile-card-compact-v257"
      aria-label="Открыть профиль"
    >
      <div className="sidebar-profile-top">
        <img className="sidebar-profile-avatar" src={safeProfile.avatar} alt="Аватар"/>
        <div>
          <b>{safeProfile.name}</b>
          <span>{safeProfile.level}</span>
        </div>
        <i>›</i>
      </div>
    </Link>
  </>
}
