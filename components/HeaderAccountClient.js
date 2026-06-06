'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { readStoredProfile, useAuthState } from '@/components/AuthStateClient'

export default function HeaderAccountClient(){
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

  if(loading) return <span className="top-auth-skeleton" aria-hidden="true" />
  if(!configured || !user) return <Link href="/auth" className="top-auth-link">Войти</Link>

  return <Link href="/profile" className="avatar-link" aria-label="Профиль">
    <img src={(profile || readStoredProfile(user)).avatar} alt="Профиль"/>
  </Link>
}
