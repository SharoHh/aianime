'use client'

import Link from 'next/link'
import { useAuthState } from '@/components/AuthStateClient'

export default function AuthRequiredClient({ children, title = 'Нужно войти в аккаунт', text = 'Этот раздел доступен только после авторизации.' }){
  const { loading, configured, user } = useAuthState()

  if(loading){
    return <section className="profile-clean-card widget profile-loading-card" aria-hidden="true" />
  }

  if(!configured){
    return <section className="auth-required-card widget">
      <span>авторизация</span>
      <h2>Supabase Auth не включён</h2>
      <p>Добавь публичные переменные Supabase и включи <b>NEXT_PUBLIC_ENABLE_SUPABASE_RUNTIME=1</b>. После этого вход и профиль станут доступны.</p>
      <Link className="secondary" href="/">На главную</Link>
    </section>
  }

  if(!user){
    return <section className="auth-required-card widget">
      <span>закрытый раздел</span>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="auth-required-actions">
        <Link className="primary" href="/auth">Войти</Link>
        <Link className="secondary" href="/catalog">В каталог</Link>
      </div>
    </section>
  }

  return children
}
