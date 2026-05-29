'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const MAX_SESSION_PREFETCHES = 40

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

function samePageHashNavigation(href){
  try{
    const url = new URL(href, window.location.origin)
    return url.pathname === window.location.pathname && url.search === window.location.search && Boolean(url.hash)
  }catch{
    return false
  }
}

function shouldIgnoreClick(event, link){
  if(!link) return true
  if(event.defaultPrevented) return true
  if(typeof event.button === 'number' && event.button !== 0) return true
  if(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true
  if(link.target && link.target !== '_self') return true
  if(link.hasAttribute('download')) return true
  return false
}

export default function RouteWarmupClient(){
  const router = useRouter()
  const pathname = usePathname()
  const [active,setActive] = useState(false)
  const prefetchedRef = useRef(new Set())
  const finishTimerRef = useRef(null)
  const safetyTimerRef = useRef(null)
  const lastPathRef = useRef(pathname)

  function clearTimers(){
    if(finishTimerRef.current) clearTimeout(finishTimerRef.current)
    if(safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
    finishTimerRef.current = null
    safetyTimerRef.current = null
  }

  function finishTransition(delay = 80){
    if(finishTimerRef.current) clearTimeout(finishTimerRef.current)
    finishTimerRef.current = setTimeout(()=>setActive(false), delay)
  }

  function startSoftProgress(){
    setActive(true)
    if(safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
    safetyTimerRef.current = setTimeout(()=>setActive(false), 900)
  }

  function warmPath(path){
    if(!path || prefetchedRef.current.has(path)) return
    if(prefetchedRef.current.size >= MAX_SESSION_PREFETCHES) return
    prefetchedRef.current.add(path)
    try{ router.prefetch(path) }catch{}
  }

  function warmLink(link){
    const href = link?.getAttribute?.('href')
    if(!isInternalHref(href) || samePageHashNavigation(href)) return
    warmPath(toPrefetchPath(href))
  }

  useEffect(()=>{
    if(lastPathRef.current !== pathname){
      lastPathRef.current = pathname
      finishTransition(70)
    }else{
      finishTransition(120)
    }
    return clearTimers
  }, [pathname])

  useEffect(()=>{
    function findLink(target){
      return target?.closest?.('a[href]')
    }

    function onPointerEnter(event){
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
      if(shouldIgnoreClick(event, link)) return
      if(!isInternalHref(href) || samePageHashNavigation(href)) return
      warmLink(link)
      startSoftProgress()
    }

    function onPageShow(){
      finishTransition(40)
    }

    function onVisibilityChange(){
      if(document.visibilityState === 'visible') finishTransition(40)
    }

    document.addEventListener('pointerenter', onPointerEnter, true)
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('touchstart', onTouchStart, { capture:true, passive:true })
    document.addEventListener('click', onClick, true)
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibilityChange)

    const warmCoreLinks = () => {
      ['/', '/catalog', '/ai', '/schedule', '/collections', '/profile'].forEach(warmPath)
    }
    const idleId = 'requestIdleCallback' in window
      ? window.requestIdleCallback(warmCoreLinks, { timeout:1000 })
      : setTimeout(warmCoreLinks, 450)

    return () => {
      document.removeEventListener('pointerenter', onPointerEnter, true)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('touchstart', onTouchStart, true)
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if('cancelIdleCallback' in window && typeof idleId === 'number') window.cancelIdleCallback(idleId)
      else clearTimeout(idleId)
      clearTimers()
    }
  }, [router])

  return <div className={`route-progress-bar ${active ? 'is-active' : ''}`} aria-hidden="true" />
}
