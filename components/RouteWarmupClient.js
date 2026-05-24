'use client'

import { useEffect, useRef, useState, startTransition } from 'react'
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

function getNavigationPath(event, link){
  if(!link) return null
  if(event.defaultPrevented) return null
  if(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null
  if(link.target && link.target !== '_self') return null
  if(link.hasAttribute('download')) return null
  const href = link.getAttribute('href')
  if(!isInternalHref(href)) return null
  try{
    const url = new URL(href, window.location.origin)
    const currentPath = `${window.location.pathname}${window.location.search}`
    const nextPath = `${url.pathname}${url.search}`
    if(nextPath === currentPath){
      // Обычные якоря внутри текущей страницы не перехватываем.
      return null
    }
    return `${url.pathname}${url.search}${url.hash || ''}`
  }catch{
    return null
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
      const nextPath = getNavigationPath(event, link)
      if(!nextPath) return

      // Важно: перехватываем даже обычные <a>, чтобы не было полной перезагрузки
      // документа и белого кадра браузера между страницами.
      event.preventDefault()
      warmLink(link)
      setActive(true)

      if(timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(()=>setActive(false), 1800)

      startTransition(()=>{
        router.push(nextPath)
      })
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

    const warmCoreLinks = ()=>{
      ['/', '/catalog', '/genres', '/top', '/ai', '/schedule', '/collections'].forEach(path=>{
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
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      observer?.disconnect()
      mutationObserver?.disconnect()
      clearTimers()
    }
  }, [router, pathname])

  return <div className={`route-progress-bar ${active ? 'is-active' : ''}`} aria-hidden="true" />
}
