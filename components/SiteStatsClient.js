'use client'

import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'aianime:site-stats:v2'
const GLOBAL_REFRESH_MS = 60000
const PRESENCE_REFRESH_MS = 30000

function formatNumber(value){
  if(value === null || value === undefined || value === '') return '—'
  if(value === '—') return '—'
  const number = Number(value)
  if(Number.isNaN(number)) return String(value)
  return new Intl.NumberFormat('ru-RU').format(number)
}

function hasRealStat(value){
  return value !== null && value !== undefined && value !== '' && value !== '—'
}

function mergeRealStats(prev, entries){
  const next = { ...prev }
  for(const [key, value] of Object.entries(entries || {})){
    if(hasRealStat(value)) next[key] = formatNumber(value)
  }
  return next
}

function initialSnapshot(stats){
  const result = {}
  for(const item of Array.isArray(stats) ? stats : []){
    if(item?.key && hasRealStat(item.value)) result[item.key] = item.value
  }
  return result
}

function readStoredStats(){
  if(typeof window === 'undefined') return {}
  try{
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
    if(!parsed || typeof parsed !== 'object') return {}
    return parsed.values && typeof parsed.values === 'object' ? parsed.values : {}
  }catch{
    return {}
  }
}

function storeStats(values){
  if(typeof window === 'undefined') return
  try{
    const stable = {}
    for(const key of ['accounts','anime','comments','openTabs','online']){
      if(hasRealStat(values?.[key])) stable[key] = values[key]
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ values:stable, savedAt:Date.now() }))
  }catch{}
}

function getVisitorId(){
  if(typeof window === 'undefined') return 'server'
  try{
    const key = 'aianime:visitor-id'
    let id = window.localStorage.getItem(key)
    if(!id){
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`
      window.localStorage.setItem(key, id)
    }
    return id
  }catch{
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`
  }
}

function getTabId(){
  if(typeof window === 'undefined') return 'server-tab'
  try{
    const key = 'aianime:tab-id'
    let id = window.sessionStorage.getItem(key)
    if(!id){
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`
      window.sessionStorage.setItem(key, id)
    }
    return id
  }catch{
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`
  }
}

async function pingPresence(visitorId, tabId){
  const res = await fetch('/api/presence', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ visitorId, tabId, page:window.location.pathname }),
    cache:'no-store',
  })
  if(!res.ok) throw new Error('presence failed')
  return res.json()
}

async function fetchSiteStats(){
  const res = await fetch('/api/site-stats', { cache:'no-store' })
  if(!res.ok) throw new Error('site stats failed')
  return res.json()
}

function StatIcon({ type }){
  const common = {
    viewBox:'0 0 24 24',
    fill:'none',
    stroke:'currentColor',
    strokeWidth:'1.9',
    strokeLinecap:'round',
    strokeLinejoin:'round',
    'aria-hidden':'true',
  }

  if(type === 'accounts') return <svg {...common}><path d="M16 19c0-2.3-1.8-4-4-4s-4 1.7-4 4"/><circle cx="12" cy="8" r="3.2"/></svg>
  if(type === 'anime') return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1.2"/><rect x="14" y="4" width="6" height="6" rx="1.2"/><rect x="4" y="14" width="6" height="6" rx="1.2"/><rect x="14" y="14" width="6" height="6" rx="1.2"/></svg>
  if(type === 'episodesToday') return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M9 15h.01M12 15h.01M15 15h.01"/></svg>
  if(type === 'comments') return <svg {...common}><path d="M5 18.5V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5.5a3 3 0 0 1-3 3H9l-4 3Z"/></svg>
  if(type === 'openTabs') return <svg {...common}><rect x="7" y="7" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>
  if(type === 'online') return <span className="site-stat-online-dot" />
  return null
}

export default function SiteStatsClient({ initialStats = [] }){
  const baseStats = useMemo(() => Array.isArray(initialStats) ? initialStats : [], [initialStats])
  const [liveStats, setLiveStats] = useState({})

  useEffect(() => {
    let cancelled = false
    const retryTimers = new Set()
    const visitorId = getVisitorId()
    const tabId = getTabId()
    const serverValues = initialSnapshot(baseStats)
    const cachedValues = readStoredStats()

    setLiveStats(prev => mergeRealStats(mergeRealStats(prev, cachedValues), serverValues))
    storeStats({ ...cachedValues, ...serverValues })

    function commit(entries){
      if(cancelled) return
      setLiveStats(prev => {
        const next = mergeRealStats(prev, entries)
        storeStats(next)
        return next
      })
    }

    async function updatePresence(){
      try{
        const data = await pingPresence(visitorId, tabId)
        commit({
          online:data?.online ?? 1,
          openTabs:data?.openTabs ?? 1,
        })
      }catch{
        commit({ online:1, openTabs:1 })
      }
    }

    async function updateGlobalStats(){
      try{
        const data = await fetchSiteStats()
        if(cancelled) return false
        commit({
          accounts:data?.accounts,
          anime:data?.anime,
          comments:data?.comments,
          openTabs:data?.openTabs,
          online:data?.online,
        })
        return true
      }catch{
        return false
      }
    }

    async function refreshWithRetries(){
      const ok = await updateGlobalStats()
      if(ok || cancelled) return
      for(const delay of [5000, 15000]){
        const timer = window.setTimeout(() => {
          retryTimers.delete(timer)
          if(!cancelled) updateGlobalStats()
        }, delay)
        retryTimers.add(timer)
      }
    }

    function refreshWhenVisible(){
      if(document.visibilityState === 'visible'){
        updatePresence()
        updateGlobalStats()
      }
    }

    updatePresence()
    refreshWithRetries()
    const presenceTimer = window.setInterval(updatePresence, PRESENCE_REFRESH_MS)
    const statsTimer = window.setInterval(updateGlobalStats, GLOBAL_REFRESH_MS)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      cancelled = true
      window.clearInterval(presenceTimer)
      window.clearInterval(statsTimer)
      for(const timer of retryTimers) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [baseStats])

  return <div className="widget site-stats-widget">
    <div className="site-stats-title"><span className="site-stats-title-icon"><StatIcon type="analytics" /></span><h3>Статистика сайта</h3></div>
    <div className="site-stats-line" />
    <div className="site-stats-list">
      {baseStats.map((item)=><div className={`site-stat-row ${item.dividerBefore ? 'with-divider' : ''} ${item.isOnline ? 'online' : ''}`} key={item.key || item.label}>
        <span className="site-stat-icon"><StatIcon type={item.icon} /></span>
        <span className="site-stat-label">{item.label}</span>
        <strong>{liveStats[item.key] ?? item.value}</strong>
      </div>)}
    </div>
  </div>
}
