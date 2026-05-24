'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

function isInternalHref(href){
  if(!href || href.startsWith('#')) return false
  if(href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return false
  try{
    const url = new URL(href, window.location.origin)
    return url.origin === window.location.origin
  }catch{
    return false
  }
}

function toPrefetchPath(href){
  try{
    const url = new URL(href, window.location.origin)
    return `${url.pathname}${url.search}`
  }catch{
    return href
  }
}

function isHashOnlyNavigation(href){
  try{
    const url = new URL(href, window.location.origin)
    return url.pathname === window.location.pathname && url.search === window.location.search && Boolean(url.hash)
  }catch{
    return false
  }
}

export default function RouteWarmupClient(){
  const router = useRouter()
  const pathname = usePathname()
  const [active,setActive] = useState(false)
  const prefetchedRef = useRef(new Set())
  const finishTimerRef = useRef(null)
  const safetyTimerRef = useRef(null)

  function finishTransition(delay = 90){
    if(finishTimerRef.current) clearTimeout(finishTimerRef.current)
    finishTimerRef.current = setTimeout(()=>setActive(false), delay)
  }

  function startSoftProgress(){
    setActive(true)
    if(safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
    safetyTimerRef.current = setTimeout(()=>setActive(false), 1600)
  }

  useEffect(()=>{
    finishTransition()
    return ()=>{
      if(finishTimerRef.current) clearTimeout(finishTimerRef.current)
      if(safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
    }
  }, [pathname])

  useEffect(()=>{
    function warmLink(link){
      const href = link?.getAttribute?.('href')
      if(!isInternalHref(href)) return
      const path = toPrefetchPath(href)
      if(!path || prefetchedRef.current.has(path)) return
      prefetchedRef.current.add(path)
      try{ router.prefetch(path) }catch{}
    }

    function findLink(target){
      return target?.closest?.('a[href]')
    }

    function onPointerEnter(event){
      warmLink(findLink(event.target))
    }

    function onPointerOver(event){
      warmLink(findLink(event.target))
    }

    function onFocusIn(event){
      warmLink(findLink(event.target))
    }

    function onTouchStart(event){
      warmLink(findLink(event.target))
    }

    function onClick(event){
      const link = findLink(event.target)
      const href = link?.getAttribute?.('href')
      if(!href || !isInternalHref(href) || isHashOnlyNavigation(href)) return
      if(event.defaultPrevented) return
      if(typeof event.button === 'number' && event.button !== 0) return
      if(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if(link.target && link.target !== '_self') return
      if(link.hasAttribute('download')) return

      // Не перехватываем переходы router.push здесь. Пусть Next.js Link/браузер
      // сами выполняют навигацию — так не появляется зависание при back/forward
      // и не ломается возврат с профиля на главную. Здесь только лёгкий индикатор.
      warmLink(link)
      startSoftProgress()
    }

    function onPopState(){
      startSoftProgress()
      finishTransition(700)
    }

    function onPageShow(){
      finishTransition()
    }

    function onVisibilityChange(){
      if(document.visibilityState === 'visible') finishTransition()
    }

    document.addEventListener('pointerenter', onPointerEnter, true)
    document.addEventListener('pointerover', onPointerOver, true)
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('touchstart', onTouchStart, { capture:true, passive:true })
    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', onPopState)
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibilityChange)

    const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          warmLink(entry.target)
          observer.unobserve(entry.target)
        }
      })
    }, { rootMargin:'260px 0px' }) : null

    function observeLinks(){
      if(!observer) return
      document.querySelectorAll('a[href^="/"], a[href^="https://aianime.ru"], a[href^="http://aianime.ru"]').forEach(link=>observer.observe(link))
    }

    observeLinks()

    const warmCoreLinks = ()=>{
      ['/', '/catalog', '/genres', '/top', '/ai', '/schedule', '/collections', '/profile'].forEach(path=>{
        if(prefetchedRef.current.has(path)) return
        prefetchedRef.current.add(path)
        try{ router.prefetch(path) }catch{}
      })
    }
    if('requestIdleCallback' in window){
      window.requestIdleCallback(warmCoreLinks, { timeout:1400 })
    }else{
      setTimeout(warmCoreLinks, 350)
    }

    const mutationObserver = 'MutationObserver' in window ? new MutationObserver(()=>observeLinks()) : null
    mutationObserver?.observe(document.body, { childList:true, subtree:true })

    return ()=>{
      document.removeEventListener('pointerenter', onPointerEnter, true)
      document.removeEventListener('pointerover', onPointerOver, true)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('touchstart', onTouchStart, true)
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      observer?.disconnect()
      mutationObserver?.disconnect()
      if(finishTimerRef.current) clearTimeout(finishTimerRef.current)
      if(safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
    }
  }, [router])

  return <div className={`route-progress-bar ${active ? 'is-active' : ''}`} aria-hidden="true" />
}
