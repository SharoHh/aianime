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
  const [open,setOpen] = useState(false)
  const wrapRef = useRef(null)

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

  useEffect(()=>{
    if(!open) return
    const onPointerDown = event => {
      if(wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false)
    }
    const onKeyDown = event => {
      if(event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

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
    setOpen(false)
    pushToast(value ? `Добавлено в библиотеку: ${libraryStatusLabel(value)}` : 'Удалено из библиотеки', 'success')
  }

  if(!safeItem.slug) return null

  const label = status ? libraryStatusLabel(status) : 'Добавить в список'

  if(!user){
    return <div className="title-watchlist" aria-label="Моя библиотека">
      <Link className="title-watchlist-trigger" href={loginHref()} prefetch={false}>
        <span className="title-watchlist-icon" aria-hidden="true">☰</span>
        <span className="title-watchlist-label">Войти и добавить</span>
        <span className="title-watchlist-caret" aria-hidden="true">›</span>
      </Link>
    </div>
  }

  return <div ref={wrapRef} className={`title-watchlist ${open ? 'is-open' : ''}`} aria-label="Моя библиотека">
    <button
      type="button"
      className="title-watchlist-trigger"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen(v => !v)}
    >
      <span className="title-watchlist-icon" aria-hidden="true">☰</span>
      <span className="title-watchlist-label">{label}</span>
      <span className="title-watchlist-caret" aria-hidden="true">⌄</span>
    </button>

    {open ? <div className="title-watchlist-menu" role="menu">
      {LIBRARY_STATUSES.map(option => <button
        type="button"
        role="menuitemradio"
        key={option.value}
        className={status === option.value ? 'active' : ''}
        aria-checked={status === option.value}
        onClick={() => choose(option.value)}
      >
        <span>{option.label}</span>
        {status === option.value ? <b aria-hidden="true">✓</b> : null}
      </button>)}
      {status ? <button type="button" role="menuitem" className="muted" onClick={() => choose(status)}>
        <span>Убрать из списка</span>
      </button> : null}
    </div> : null}
  </div>
}
