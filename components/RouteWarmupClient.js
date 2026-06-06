'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// AIanime v159
// Убрали ручной router.prefetch: он создавал лишнюю предзагрузку тайтлов и забивал переходы.
// Оставляем только тонкий индикатор при реально не мгновенном клике.
export default function RouteWarmupClient(){
  const pathname = usePathname()
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

    showTimerRef.current = window.setTimeout(() => {
      try{
        const bar = ensureProgress()
        document.documentElement.classList.add('aianime-route-pending')
        bar.classList.add('is-active')
      }catch{}
    }, 140)

    fallbackTimerRef.current = window.setTimeout(stopProgress, 2200)
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
      }, 160)
    }catch{}
  }

  useEffect(() => {
    stopProgress()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    function onClick(event){
      if(isModifiedEvent(event)) return
      const url = linkUrl(event.target)
      if(!url) return
      startProgress()
    }

    window.addEventListener('click', onClick, true)

    return () => {
      window.removeEventListener('click', onClick, true)
      window.clearTimeout(showTimerRef.current)
      window.clearTimeout(hideTimerRef.current)
      window.clearTimeout(fallbackTimerRef.current)
      try{ progressRef.current?.remove() }catch{}
      progressRef.current = null
      document.documentElement.classList.remove('aianime-route-pending')
    }
  }, [])

  return null
}
