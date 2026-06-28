'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { readStoredProfile, useAuthState } from '@/components/AuthStateClient'

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

  if(loading) return <span className="aianime-header-v262__profile is-loading" aria-hidden="true">...</span>

  if(configured && user){
    const current = profile || readStoredProfile(user)
    return <Link href="/profile" className="aianime-header-v262__profile" aria-label="Открыть профиль">
      <img src={current.avatar} alt="" aria-hidden="true" />
      <span><b>Профиль</b><small>{current.level || 'Аккаунт'}</small></span>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </Link>
  }

  return <Link href="/auth" className="aianime-header-v262__profile is-guest">
    <span><b>Войти</b><small>Личный кабинет</small></span>
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m7 4 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </Link>
}
