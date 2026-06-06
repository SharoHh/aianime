'use client'

import Link from 'next/link'
import { useAuthState } from '@/components/AuthStateClient'

export default function TitleAuthActionClient(){
  const { loading, configured, user } = useAuthState()

  if(loading) return <span className="title-nav-profile title-nav-auth-loading" aria-hidden="true">...</span>
  if(configured && user){
    return <Link href="/profile" className="title-nav-profile">Профиль</Link>
  }

  return <>
    <Link href="/auth" className="title-nav-profile">Вход</Link>
    <Link href="/auth" className="title-wide-header-v80__signup">Регистрация</Link>
  </>
}
