'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getFavorites, saveHistoryItem, toggleFavoriteItem } from '@/lib/userStorage'
import { pushToast } from '@/components/ToastCenter'
import { useAuthState } from '@/components/AuthStateClient'

function loginHref(){
  if(typeof window === 'undefined') return '/auth'
  return `/auth?next=${encodeURIComponent(window.location.pathname + window.location.hash)}`
}

export default function TitleActions({ item }){
  const { user } = useAuthState()
  const [favorite,setFavorite] = useState(false)
  const [saved,setSaved] = useState(false)

  useEffect(()=>{
    const update = () => setFavorite(Boolean(user) && getFavorites().some(x => x.slug === item.slug))
    update()
    window.addEventListener('storage', update)
    window.addEventListener('anime:user-updated', update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener('anime:user-updated', update)
    }
  }, [item.slug, user?.id])

  function requireLogin(){
    pushToast('Войди в аккаунт, чтобы сохранять тайтлы.', 'error')
    return false
  }

  function toggleFavorite(){
    if(!user) return requireLogin()
    const next = toggleFavoriteItem(item)
    setFavorite(next)
    pushToast(next ? 'Добавлено в избранное' : 'Удалено из избранного', 'success')
  }

  function addHistory(){
    if(!user) return requireLogin()
    const savedOk = saveHistoryItem(item, 1, 8)
    if(!savedOk) return requireLogin()
    setSaved(true)
    pushToast('Добавлено в историю', 'success')
    setTimeout(()=>setSaved(false), 1600)
  }

  if(!user){
    return <>
      <Link className="secondary" href={loginHref()}>♡ Войти для избранного</Link>
      <Link className="secondary" href={loginHref()}>◷ Войти для истории</Link>
    </>
  }

  return <>
    <button className="secondary" onClick={toggleFavorite}>{favorite ? '♥ В избранном' : '♡ В избранное'}</button>
    <button className="secondary" onClick={addHistory}>{saved ? '✓ Добавлено' : '◷ В историю'}</button>
  </>
}
