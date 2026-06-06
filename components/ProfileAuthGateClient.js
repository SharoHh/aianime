'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getFavorites, getHistory, getRatings, getLibrary } from '@/lib/userStorage'
import { getUserDisplayName, readStoredProfile, useAuthState } from '@/components/AuthStateClient'
import ProfileEditorClient from '@/components/ProfileEditorClient'
import ProfileLibraryClient from '@/components/ProfileLibraryClient'
import UserSyncStatusClient from '@/components/UserSyncStatusClient'

function readStats(){
  return {
    favorites:getFavorites().length,
    history:getHistory().length,
    ratings:Object.keys(getRatings() || {}).length,
    library:Object.keys(getLibrary() || {}).length
  }
}

export default function ProfileAuthGateClient(){
  const { loading, user, signOut } = useAuthState()
  const [stats,setStats] = useState({ favorites:0, history:0, ratings:0, library:0 })
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
    return <section className="auth-required-card widget profile-auth-check-card">
      <span>профиль</span>
      <h2>Проверяем вход</h2>
      <p>Секунду, открываем данные аккаунта.</p>
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
    <section className="profile-account-hero widget profile-account-hero-v7">
      <img className="profile-account-cover-v7" src={safeProfile.cover} alt="" aria-hidden="true"/>
      <div className="profile-account-main">
        <img src={safeProfile.avatar} alt="Аватар"/>
        <div>
          <span>профиль активен</span>
          <h2>{safeProfile.name || displayName}</h2>
          <p>{user.email}</p>
        </div>
      </div>
      <div className="profile-account-stats">
        <Link href="/favorites"><b>{stats.favorites}</b><span>Избранное</span></Link>
        <Link href="/history"><b>{stats.history}</b><span>История</span></Link>
        <Link href="/profile"><b>{stats.ratings}</b><span>Оценки</span></Link>
        <a href="#profile-library"><b>{stats.library}</b><span>Библиотека</span></a>
      </div>
      <div className="profile-account-actions-v7">
        <a className="secondary" href="#profile-library">Библиотека</a>
        <Link className="secondary" href="/catalog">Каталог</Link>
        <button className="secondary" onClick={signOut}>Выйти</button>
      </div>
    </section>

    <UserSyncStatusClient/>
    <ProfileLibraryClient/>
    <ProfileEditorClient user={user}/>
  </>
}
