'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getFavorites, getHistory, getRatings } from '@/lib/userStorage'
import { getUserDisplayName, readStoredProfile, useAuthState } from '@/components/AuthStateClient'
import ProfileEditorClient from '@/components/ProfileEditorClient'
import AccountSyncClient from '@/components/AccountSyncClient'

function readStats(){
  return {
    favorites:getFavorites().length,
    history:getHistory().length,
    ratings:Object.keys(getRatings() || {}).length
  }
}

export default function ProfileAuthGateClient(){
  const { loading, configured, user, signOut } = useAuthState()
  const [stats,setStats] = useState({ favorites:0, history:0, ratings:0 })
  const [profile,setProfile] = useState(null)

  useEffect(()=>{
    if(!user) return undefined
    const update = () => {
      setStats(readStats())
      setProfile(readStoredProfile(user))
    }
    update()
    window.addEventListener('storage', update)
    window.addEventListener('anime:user-updated', update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener('anime:user-updated', update)
    }
  }, [user])

  const displayName = useMemo(() => getUserDisplayName(user), [user])

  if(loading){
    return <section className="profile-clean-card widget profile-loading-card" aria-hidden="true" />
  }

  if(!configured){
    return <section className="auth-required-card widget">
      <span>авторизация</span>
      <h2>Supabase Auth не включён</h2>
      <p>Профиль скрыт до подключения Supabase Auth. Проверь переменные NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY и NEXT_PUBLIC_ENABLE_SUPABASE_RUNTIME=1.</p>
      <Link className="secondary" href="/">На главную</Link>
    </section>
  }

  if(!user){
    return <section className="auth-required-card widget">
      <span>профиль</span>
      <h2>Войди, чтобы открыть профиль</h2>
      <p>Настройки профиля, аватар, фон и синхронизация больше не показываются гостям.</p>
      <div className="auth-required-actions">
        <Link className="primary" href="/auth">Войти</Link>
        <Link className="secondary" href="/catalog">Смотреть каталог</Link>
      </div>
    </section>
  }

  const safeProfile = profile || readStoredProfile(user)

  return <>
    <section className="profile-account-hero widget">
      <div className="profile-account-main">
        <img src={safeProfile.avatar} alt="Аватар"/>
        <div>
          <span>аккаунт подключён</span>
          <h2>{safeProfile.name || displayName}</h2>
          <p>{user.email}</p>
        </div>
      </div>
      <div className="profile-account-stats">
        <Link href="/favorites"><b>{stats.favorites}</b><span>Избранное</span></Link>
        <Link href="/history"><b>{stats.history}</b><span>История</span></Link>
        <Link href="/profile"><b>{stats.ratings}</b><span>Оценки</span></Link>
      </div>
      <button className="secondary" onClick={signOut}>Выйти</button>
    </section>

    <ProfileEditorClient user={user}/>
    <AccountSyncClient/>
  </>
}
