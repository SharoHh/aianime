'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { LIBRARY_STATUSES, getLibraryStatus, libraryStatusLabel, setLibraryStatus } from '@/lib/userStorage'
import { useAuthState } from '@/components/AuthStateClient'
import { pushToast } from '@/components/ToastCenter'

function loginHref(){
  if(typeof window === 'undefined') return '/auth'
  return `/auth?next=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`
}

export default function LibraryStatusClient({ item }){
  const { user } = useAuthState()
  const [status,setStatus] = useState('')

  const safeItem = useMemo(() => ({
    slug:item?.slug,
    title:item?.title,
    poster:item?.poster,
    banner:item?.banner,
    rating:item?.rating,
    meta:item?.meta,
    episode:item?.episode || 1,
    voice:item?.voice || null
  }), [item?.slug, item?.title, item?.poster, item?.banner, item?.rating, item?.meta, item?.episode, item?.voice])

  useEffect(()=>{
    const update = () => setStatus(user ? getLibraryStatus(safeItem.slug) : '')
    update()
    window.addEventListener('storage', update)
    window.addEventListener('anime:user-updated', update)
    window.addEventListener('anime:library-updated', update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener('anime:user-updated', update)
      window.removeEventListener('anime:library-updated', update)
    }
  }, [safeItem.slug, user?.id])

  function choose(nextStatus){
    if(!user){
      pushToast('Войди, чтобы вести свою библиотеку.', 'error')
      return
    }
    const value = status === nextStatus ? '' : nextStatus
    const ok = setLibraryStatus(safeItem, value)
    if(!ok){
      pushToast('Войди, чтобы вести свою библиотеку.', 'error')
      return
    }
    setStatus(value)
    pushToast(value ? `Добавлено в библиотеку: ${libraryStatusLabel(value)}` : 'Удалено из библиотеки', 'success')
  }

  if(!safeItem.slug) return null

  if(!user){
    return <div className="title-library-dropdown title-library-dropdown-guest" aria-label="Моя библиотека">
      <span>Моя библиотека</span>
      <Link href={loginHref()} prefetch={false}>Войти</Link>
    </div>
  }

  return <details className="title-library-dropdown" aria-label="Моя библиотека">
    <summary>
      <span>Моя библиотека</span>
      <b>{status ? libraryStatusLabel(status) : 'Выбрать статус'}</b>
    </summary>
    <div className="title-library-dropdown-menu" role="group" aria-label="Статус тайтла в библиотеке">
      {LIBRARY_STATUSES.map(option => <button
        type="button"
        key={option.value}
        className={status === option.value ? 'active' : ''}
        aria-pressed={status === option.value}
        onClick={() => choose(option.value)}
      >{option.label}</button>)}
      {status ? <button type="button" className="muted" onClick={() => choose(status)}>Убрать</button> : null}
    </div>
  </details>
}
