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

function shouldHandleClick(event, link){
  if(!link) return false
  if(event.defaultPrevented) return false
  if(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  if(link.target && link.target !== '_self') return false
  if(link.hasAttribute('download')) return false
  const href = link.getAttribute('href')
  if(!isInternalHref(href)) return false
  try{
    const url = new URL(href, window.location.origin)
    if(url.pathname === window.location.pathname && url.search === window.location.search) return false
    return true
  }catch{
    return false
  }
}

export default function RouteWarmupClient(){
  const router = useRouter()
  const pathname = usePathname()
  const [active,setActive] = useState(false)
  const prefetchedRef = useRef(new Set())
  const timerRef = useRef(null)
  const finishTimerRef = useRef(null)

  function clearTimers(){
    if(timerRef.current) clearTimeout(timerRef.current)
    if(finishTimerRef.current) clearTimeout(finishTimerRef.current)
    timerRef.current = null
    finishTimerRef.current = null
  }

  function finishTransition(){
    if(finishTimerRef.current) clearTimeout(finishTimerRef.current)
    finishTimerRef.current = setTimeout(()=>setActive(false), 90)
  }

  useEffect(()=>{
    finishTransition()
    return ()=>clearTimers()
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
      if(!shouldHandleClick(event, link)) return
      warmLink(link)
      setActive(true)
      if(timerRef.current) clearTimeout(timerRef.current)
      // Страховка: если навигация отменится или ответ сервера затянется, экран не зависнет.
      timerRef.current = setTimeout(()=>setActive(false), 2400)
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
    const mutationObserver = 'MutationObserver' in window ? new MutationObserver(()=>observeLinks()) : null
    mutationObserver?.observe(document.body, { childList:true, subtree:true })

    return ()=>{
      document.removeEventListener('pointerenter', onPointerEnter, true)
      document.removeEventListener('pointerover', onPointerOver, true)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('touchstart', onTouchStart, true)
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      observer?.disconnect()
      mutationObserver?.disconnect()
      clearTimers()
    }
  }, [router, pathname])

  return <>
    <div className={`route-progress-bar ${active ? 'is-active' : ''}`} aria-hidden="true" />
    <div className={`route-transition-surface ${active ? 'is-visible' : ''}`} aria-hidden="true">
      <div className="route-transition-card">
        <span />
        <span />
        <span />
      </div>
    </div>
  </>
}
