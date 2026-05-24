'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

function isModifiedClick(event){
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
}

function getInternalUrl(anchor){
  if(!anchor) return null
  const href = anchor.getAttribute('href')
  if(!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null
  if(anchor.target && anchor.target !== '_self') return null
  if(anchor.hasAttribute('download')) return null

  try{
    const url = new URL(href, window.location.href)
    if(url.origin !== window.location.origin) return null
    if(url.pathname.startsWith('/api/')) return null
    if(url.pathname === window.location.pathname && url.search === window.location.search) return null
    return url
  }catch{
    return null
  }
}

export default function InstantNavigation(){
  const router = useRouter()
  const pathname = usePathname()
  const prefetched = useRef(new Set())
  const clearTimer = useRef(null)

  useEffect(()=>{
    document.documentElement.classList.remove('is-route-changing')
    document.documentElement.classList.add('is-route-ready')
    if(clearTimer.current) window.clearTimeout(clearTimer.current)
  }, [pathname])

  useEffect(()=>{
    const prefetchUrl = (url) => {
      if(!url) return
      const key = `${url.pathname}${url.search}`
      if(prefetched.current.has(key)) return
      prefetched.current.add(key)
      try{ router.prefetch(key) }catch{}
    }

    const prefetchAnchor = (anchor) => prefetchUrl(getInternalUrl(anchor))

    const onPointerEnter = (event) => {
      const anchor = event.target?.closest?.('a[href]')
      prefetchAnchor(anchor)
    }

    const onTouchStart = (event) => {
      const anchor = event.target?.closest?.('a[href]')
      prefetchAnchor(anchor)
    }

    const onClick = (event) => {
      if(isModifiedClick(event)) return
      const anchor = event.target?.closest?.('a[href]')
      const url = getInternalUrl(anchor)
      if(!url) return
      prefetchUrl(url)
      document.documentElement.classList.add('is-route-changing')
      if(clearTimer.current) window.clearTimeout(clearTimer.current)
      clearTimer.current = window.setTimeout(()=>{
        document.documentElement.classList.remove('is-route-changing')
      }, 6500)
    }

    const idlePrefetch = () => {
      const anchors = Array.from(document.querySelectorAll('a[href]'))
        .filter(anchor => getInternalUrl(anchor))
        .slice(0, 70)
      anchors.forEach((anchor, index)=>{
        window.setTimeout(()=>prefetchAnchor(anchor), index * 35)
      })
    }

    const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          prefetchAnchor(entry.target)
          observer.unobserve(entry.target)
        }
      })
    }, { rootMargin: '360px 0px' }) : null

    const observeLinks = () => {
      if(!observer) return
      document.querySelectorAll('a[href]').forEach(anchor=>{
        if(getInternalUrl(anchor)) observer.observe(anchor)
      })
    }

    const idleId = 'requestIdleCallback' in window
      ? window.requestIdleCallback(()=>{ idlePrefetch(); observeLinks() }, { timeout: 1800 })
      : window.setTimeout(()=>{ idlePrefetch(); observeLinks() }, 900)

    document.addEventListener('pointerenter', onPointerEnter, true)
    document.addEventListener('touchstart', onTouchStart, { passive:true, capture:true })
    document.addEventListener('click', onClick, true)

    return () => {
      document.removeEventListener('pointerenter', onPointerEnter, true)
      document.removeEventListener('touchstart', onTouchStart, true)
      document.removeEventListener('click', onClick, true)
      if('cancelIdleCallback' in window && typeof idleId === 'number') window.cancelIdleCallback(idleId)
      else window.clearTimeout(idleId)
      if(observer) observer.disconnect()
      if(clearTimer.current) window.clearTimeout(clearTimer.current)
    }
  }, [router, pathname])

  return <div className="route-progress" aria-hidden="true" />
}
