'use client'

// AIanime v123: client-side action tracking for popularity ranking.
import { useEffect } from 'react'

const TTL_BY_TYPE = {
  view: 30 * 60 * 1000,
  click: 3 * 60 * 1000,
  continue: 10 * 60 * 1000,
  favorite: 60 * 1000,
  rating: 60 * 1000
}

function keyFor(slug, type){
  return `anime:popularity:${type}:${slug}`
}

function canSend(slug, type){
  if(typeof window === 'undefined' || !slug) return false
  const ttl = TTL_BY_TYPE[type] || 5 * 60 * 1000
  try{
    const key = keyFor(slug, type)
    const last = Number(localStorage.getItem(key) || 0)
    if(last && Date.now() - last < ttl) return false
    localStorage.setItem(key, String(Date.now()))
  }catch{}
  return true
}

export function trackPopularityEvent(slug, type = 'click'){
  const cleanSlug = String(slug || '').trim()
  const cleanType = String(type || 'click').trim().toLowerCase()
  if(!canSend(cleanSlug, cleanType)) return

  const payload = JSON.stringify({
    slug: cleanSlug,
    type: cleanType,
    page: typeof window !== 'undefined' ? window.location.pathname : ''
  })

  try{
    if(navigator.sendBeacon){
      const blob = new Blob([payload], { type:'application/json' })
      if(navigator.sendBeacon('/api/popularity/event', blob)) return
    }
  }catch{}

  try{
    fetch('/api/popularity/event', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: payload,
      keepalive:true
    }).catch(()=>{})
  }catch{}
}

export default function PopularityTrackerClient({ slug, type = 'view', delay = 900 }){
  useEffect(() => {
    if(!slug) return
    const timer = window.setTimeout(() => trackPopularityEvent(slug, type), Math.max(0, Number(delay) || 0))
    return () => window.clearTimeout(timer)
  }, [slug, type, delay])

  return null
}
