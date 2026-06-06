'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// AIanime v95
// Быстрые и плавные переходы без DOM-клонов, без router.push и без агрессивных observers.
// Только мягкий prefetch по намерению пользователя + тонкий progress, если переход дольше 80 мс.
const MAX_PREFETCHES_PER_SESSION = 60

export default function RouteWarmupClient(){
  const router = useRouter()
  const pathname = usePathname()
  const prefetchedRef = useRef(new Set())
  const progressRef = useRef(null)
  const showTimerRef = useRef(null)
  const hideTimerRef = useRef(null)
  const fallbackTimerRef = useRef(null)

  useEffect(() => {
    try{
      document.documentElement.classList.remove('route-changing')
      document.body?.classList.remove('route-changing')
      document.querySelectorAll('.route-progress-bar,.route-transition-overlay,.route-transition-surface,.aianime-route-snapshot,.aianime-route-fastbar,[data-route-progress],[data-route-transition]').forEach(node => node.remove())
    }catch{}
  }, [])

  function isModifiedEvent(event){
    return event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
  }

  function linkUrl(target){
    const link = target?.closest?.('a[href]')
    if(!link) return null
    if(link.target && link.target !== '_self') return null
    if(link.hasAttribute('download')) return null

    const href = link.getAttribute('href') || ''
    if(!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null

    let url
    try{ url = new URL(href, window.location.href) }catch{ return null }
    if(url.origin !== window.location.origin) return null
    if(url.pathname === window.location.pathname && url.search === window.location.search) return null
    return url
  }

  function internalHref(url){
    return `${url.pathname}${url.search}`
  }

  function schedulePrefetch(url){
    if(!url) return
    const href = internalHref(url)
    const store = prefetchedRef.current
    if(store.has(href) || store.size >= MAX_PREFETCHES_PER_SESSION) return
    store.add(href)

    const run = () => {
      try{ router.prefetch(href) }catch{}
    }

    if('requestIdleCallback' in window){
      window.requestIdleCallback(run, { timeout:700 })
    }else{
      window.setTimeout(run, 90)
    }
  }

  function ensureProgress(){
    if(progressRef.current) return progressRef.current
    const bar = document.createElement('div')
    bar.className = 'aianime-route-fastbar'
    bar.setAttribute('aria-hidden', 'true')
    bar.innerHTML = '<i></i>'
    document.body.appendChild(bar)
    progressRef.current = bar
    return bar
  }

  function startProgress(){
    window.clearTimeout(showTimerRef.current)
    window.clearTimeout(hideTimerRef.current)
    window.clearTimeout(fallbackTimerRef.current)

    // Не показываем индикатор на мгновенных переходах, чтобы не было дергания.
    showTimerRef.current = window.setTimeout(() => {
      try{
        const bar = ensureProgress()
        document.documentElement.classList.add('aianime-route-pending')
        bar.classList.add('is-active')
      }catch{}
    }, 80)

    fallbackTimerRef.current = window.setTimeout(stopProgress, 2600)
  }

  function stopProgress(){
    window.clearTimeout(showTimerRef.current)
    window.clearTimeout(fallbackTimerRef.current)
    try{
      document.documentElement.classList.remove('aianime-route-pending')
      const bar = progressRef.current
      if(!bar) return
      bar.classList.add('is-finishing')
      hideTimerRef.current = window.setTimeout(() => {
        try{ bar.remove() }catch{}
        if(progressRef.current === bar) progressRef.current = null
      }, 180)
    }catch{}
  }

  useEffect(() => {
    stopProgress()
    // Следующую страницу после успешного перехода тоже слегка прогреваем для обратного хода.
    try{ router.prefetch(pathname || '/') }catch{}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    function onIntent(event){
      const url = linkUrl(event.target)
      if(url) schedulePrefetch(url)
    }

    function onClick(event){
      if(isModifiedEvent(event)) return
      const url = linkUrl(event.target)
      if(!url) return
      schedulePrefetch(url)
      startProgress()
    }

    window.addEventListener('pointerenter', onIntent, true)
    window.addEventListener('focusin', onIntent, true)
    window.addEventListener('touchstart', onIntent, { capture:true, passive:true })
    window.addEventListener('click', onClick, true)

    return () => {
      window.removeEventListener('pointerenter', onIntent, true)
      window.removeEventListener('focusin', onIntent, true)
      window.removeEventListener('touchstart', onIntent, true)
      window.removeEventListener('click', onClick, true)
      window.clearTimeout(showTimerRef.current)
      window.clearTimeout(hideTimerRef.current)
      window.clearTimeout(fallbackTimerRef.current)
      try{ progressRef.current?.remove() }catch{}
      progressRef.current = null
      document.documentElement.classList.remove('aianime-route-pending')
    }
  }, [router])

  return null
}
