'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getHistory } from '@/lib/userStorage'
import { trackPopularityEvent } from '@/components/PopularityTrackerClient'
import { isUsableAnimePoster, versionAnimePosterUrl } from '@/lib/animeQuality'

function imageSrc(value){
  const src = String(value || '').trim()
  if(!src || !isUsableAnimePoster(src)) return '/posters/magic2.svg'
  if(src.startsWith('/')) return versionAnimePosterUrl(src)
  return versionAnimePosterUrl(`/api/image?url=${encodeURIComponent(src)}&fallback=${encodeURIComponent('/posters/magic2.svg')}`)
}

function normalizeHistoryItem(item){
  if(!item?.slug) return null
  const episode = Math.max(1, Number(item.episode || 1))
  const progress = Math.max(0, Math.min(100, Number(item.progress || 0)))
  return {
    slug:item.slug,
    title:item.title || item.title_ru || item.name || 'Аниме',
    poster:imageSrc(item.poster || item.poster_url),
    episode,
    progress,
    voice:item.voice || '',
    href:`/anime/${item.slug}?episode=${episode}${item.voice ? `&voice=${encodeURIComponent(item.voice)}` : ''}&resume=1#player`
  }
}

function readLatestHistory(){
  return getHistory().map(normalizeHistoryItem).filter(Boolean)[0] || null
}

function rememberResumeClick(item){
  if(typeof window === 'undefined' || !item?.slug) return
  try{
    sessionStorage.setItem('aianime:resume-target', JSON.stringify({
      slug:item.slug,
      episode:item.episode,
      voice:item.voice || '',
      at:Date.now()
    }))
  }catch{}
  trackPopularityEvent(item.slug, 'continue')
}

export default function HomeContinueWatchingWidgetClient({ popular = [] }){
  const [latest, setLatest] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const refresh = () => {
      setLatest(readLatestHistory())
      setReady(true)
    }
    refresh()
    window.addEventListener('anime:user-updated', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('anime:user-updated', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  if(ready && latest){
    const progress = Math.max(latest.progress, 8)
    return <div className="widget home-resume-widget">
      <div className="widget-head home-resume-head">
        <h3>Продолжить просмотр</h3>
        <Link href="/history">История →</Link>
      </div>
      <Link
        href={latest.href}
        className="home-resume-card"
        prefetch={false}
        onClick={() => rememberResumeClick(latest)}
      >
        <div className="home-resume-cover">
          <img loading="lazy" decoding="async" width="560" height="315" src={latest.poster} alt={`Постер аниме ${latest.title}`}/>
          <span className="home-resume-play" aria-hidden="true">▶</span>
        </div>
        <div className="home-resume-copy">
          <b>{latest.title}</b>
          <span>Серия {latest.episode}{latest.voice ? ` · ${latest.voice}` : ''}</span>
          <div className="home-resume-progress"><i style={{width:`${progress}%`}}/></div>
          <small>{latest.progress ? `${Math.round(latest.progress)}% просмотрено` : 'Продолжить с плеера'}</small>
        </div>
      </Link>
    </div>
  }

  const items = Array.isArray(popular) ? popular.filter(item => item?.slug).slice(0, 3) : []
  return <div className="widget home-resume-widget home-popular-fallback">
    <div className="widget-head home-resume-head">
      <h3>Популярно сегодня</h3>
      <Link href="/top/popular">Топ →</Link>
    </div>
    <div className="home-popular-list">
      {items.map((item, index) => <Link href={`/anime/${item.slug}`} className="home-popular-item" key={item.slug} prefetch={false}>
        <span className="home-popular-rank">{index + 1}</span>
        <img loading="lazy" decoding="async" width="64" height="86" src={imageSrc(item.poster)} alt={`Постер аниме ${item.title || ''}`}/>
        <div>
          <b>{item.title || 'Без названия'}</b>
          <span>{item.meta || (item.genres || []).slice(0,2).join(' · ')}</span>
        </div>
        <em>★ {item.rating || '—'}</em>
      </Link>)}
    </div>
  </div>
}
