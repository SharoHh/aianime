'use client'

import Link from 'next/link'
import { useAuthState } from '@/components/AuthStateClient'

function loginHref(){
  if(typeof window === 'undefined') return '/auth'
  return `/auth?next=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`
}

export default function AuthRequiredClient({ children, title = 'Нужно войти в аккаунт', text = 'Этот раздел доступен только после авторизации.' }){
  const { loading, user } = useAuthState()

  if(loading){
    return <section className="profile-clean-card widget profile-loading-card" aria-hidden="true" />
  }

  if(!user){
    return <section className="auth-required-card widget">
      <span>закрытый раздел</span>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="auth-required-actions">
        <Link className="primary" href={loginHref()}>Войти</Link>
        <Link className="secondary" href="/catalog">В каталог</Link>
      </div>
    </section>
  }

  return children
}
