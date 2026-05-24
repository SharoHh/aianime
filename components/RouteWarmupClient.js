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

export default function RouteWarmupClient(){
  const router = useRouter()
  const pathname = usePathname()
  const [active,setActive] = useState(false)
  const prefetchedRef = useRef(new Set())
  const timerRef = useRef(null)

  useEffect(()=>{
    setActive(false)
    if(timerRef.current) clearTimeout(timerRef.current)
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

    function onFocusIn(event){
      warmLink(findLink(event.target))
    }

    function onTouchStart(event){
      warmLink(findLink(event.target))
    }

    function onClick(event){
      const link = findLink(event.target)
      if(!link) return
      const href = link.getAttribute('href')
      if(!isInternalHref(href)) return
      const url = new URL(href, window.location.origin)
      if(url.pathname === window.location.pathname && url.search === window.location.search) return
      setActive(true)
      if(timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(()=>setActive(false), 1800)
    }

    document.addEventListener('pointerenter', onPointerEnter, true)
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('touchstart', onTouchStart, { capture:true, passive:true })
    document.addEventListener('click', onClick, true)

    const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          warmLink(entry.target)
          observer.unobserve(entry.target)
        }
      })
    }, { rootMargin:'220px 0px' }) : null

    if(observer){
      document.querySelectorAll('a[href^="/"], a[href^="https://aianime.ru"], a[href^="http://aianime.ru"]').forEach(link=>observer.observe(link))
    }

    return ()=>{
      document.removeEventListener('pointerenter', onPointerEnter, true)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('touchstart', onTouchStart, true)
      document.removeEventListener('click', onClick, true)
      observer?.disconnect()
      if(timerRef.current) clearTimeout(timerRef.current)
    }
  }, [router, pathname])

  return <div className={`route-progress-bar ${active ? 'is-active' : ''}`} aria-hidden="true" />
}
