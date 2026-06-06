'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  const detailsRef = useRef(null)

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
    if(detailsRef.current) detailsRef.current.open = false
    pushToast(value ? `Добавлено в библиотеку: ${libraryStatusLabel(value)}` : 'Удалено из библиотеки', 'success')
  }

  if(!safeItem.slug) return null

  if(!user){
    return <div className="title-library-select title-library-select-guest" aria-label="Моя библиотека">
      <Link className="title-library-select-button" href={loginHref()} prefetch={false}>
        <span className="title-library-select-icon" aria-hidden="true"><i></i><i></i><i></i></span>
        <span className="title-library-select-label">Войти и добавить</span>
        <span className="title-library-select-arrow" aria-hidden="true">›</span>
      </Link>
    </div>
  }

  return <details ref={detailsRef} className="title-library-select" aria-label="Моя библиотека">
    <summary className="title-library-select-button">
      <span className="title-library-select-icon" aria-hidden="true"><i></i><i></i><i></i></span>
      <span className="title-library-select-label">{status ? libraryStatusLabel(status) : 'Добавить в список'}</span>
      <span className="title-library-select-arrow" aria-hidden="true">⌄</span>
    </summary>
    <div className="title-library-select-menu" role="group" aria-label="Статус тайтла в библиотеке">
      {LIBRARY_STATUSES.map(option => <button
        type="button"
        key={option.value}
        className={status === option.value ? 'active' : ''}
        aria-pressed={status === option.value}
        onClick={() => choose(option.value)}
      >
        <span className="title-library-option-dot" aria-hidden="true"></span>
        <span>{option.label}</span>
      </button>)}
      {status ? <button type="button" className="muted" onClick={() => choose(status)}>
        <span className="title-library-option-dot" aria-hidden="true"></span>
        <span>Убрать из списка</span>
      </button> : null}
    </div>
  </details>
}
