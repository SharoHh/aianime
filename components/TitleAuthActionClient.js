'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { readStoredProfile, useAuthState } from '@/components/AuthStateClient'

const GUEST_AVATAR = '/posters/oshi.svg'

function ProfileContent({ avatar, title, level }){
  return <>
    <img src={avatar || GUEST_AVATAR} alt="" aria-hidden="true" />
    <span><b>{title}</b><small>{level}</small></span>
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </>
}

export default function TitleAuthActionClient(){
  const { loading, configured, user } = useAuthState()
  const [profile,setProfile] = useState(null)

  useEffect(() => {
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

  if(loading) return <span className="aianime-header-v267__profile is-loading" aria-hidden="true">
    <ProfileContent avatar={GUEST_AVATAR} title="Профиль" level="Загрузка..."/>
  </span>

  if(configured && user){
    const current = profile || readStoredProfile(user)
    return <Link href="/profile" className="aianime-header-v267__profile" aria-label="Открыть профиль">
      <ProfileContent avatar={current.avatar} title="Профиль" level={current.level || 'Аккаунт'}/>
    </Link>
  }

  return <Link href="/auth" className="aianime-header-v267__profile is-guest" aria-label="Войти в профиль">
    <ProfileContent avatar={GUEST_AVATAR} title="Профиль" level="Войти в аккаунт"/>
  </Link>
}
