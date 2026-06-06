'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAuthState } from '@/components/AuthStateClient'
import { getHistory } from '@/lib/userStorage'
import { trackPopularityEvent } from '@/components/PopularityTrackerClient'

function imageSrc(value){
  const src = String(value || '').trim()
  if(!src) return '/posters/magic2.svg'
  if(src.startsWith('/api/image') || src.startsWith('/posters/') || src.startsWith('/images/') || src.startsWith('/aianime-logo')) return src
  if(/^https?:\/\//i.test(src)) return `/api/image?url=${encodeURIComponent(src)}`
  return src
}

function normalizeHistoryItem(item){
  if(!item?.slug) return null
  const episode = Math.max(1, Number(item.episode || 1))
  const progress = Math.max(0, Math.min(100, Number(item.progress || 0)))
  return {
    ...item,
    episode,
    progress,
    poster:imageSrc(item.poster || item.poster_url),
    title:item.title || item.title_ru || item.name || 'Аниме',
    meta:item.meta || `Серия ${episode}`,
    voice:item.voice || null,
    provider:item.provider || null,
    href:`/anime/${item.slug}?episode=${episode}${item.voice ? `&voice=${encodeURIComponent(item.voice)}` : ''}&resume=1#player`
  }
}

function readHistory(){
  return getHistory().map(normalizeHistoryItem).filter(Boolean)
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


// AIanime v135: continue watching opens the player directly and tracks resume actions.
export default function ContinueWatchingClient(){
  const { user, loading } = useAuthState()
  const [items,setItems] = useState([])

  useEffect(()=>{
    if(!user?.id){
      setItems([])
      return undefined
    }

    const refresh = () => setItems(readHistory().slice(0,4))
    refresh()
    window.addEventListener('anime:user-updated', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('anime:user-updated', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [user?.id])

  const hasAccount = Boolean(user?.id)
  const content = useMemo(() => {
    if(loading) return null
    if(!hasAccount){
      return <div className="continue-empty-card">
        <b>Войди, чтобы продолжить просмотр</b>
        <span>История серий будет синхронизироваться с аккаунтом и Kodik-плеером.</span>
        <Link href="/auth?next=/">Войти</Link>
      </div>
    }
    if(!items.length){
      return <div className="continue-empty-card">
        <b>История пока пустая</b>
        <span>Открой тайтл и выбери серию — она появится здесь.</span>
        <Link href="/catalog">Открыть каталог</Link>
      </div>
    }
    return <div className="continue-row continue-row-v135">
      {items.map(item => <Link
        href={item.href}
        className="continue-card resume-watch-card resume-watch-card-v135"
        key={`${item.slug}-${item.episode}`}
        prefetch={false}
        onClick={() => rememberResumeClick(item)}
        aria-label={`Продолжить смотреть ${item.title}, серия ${item.episode}`}
      >
        <img loading="lazy" decoding="async" src={item.poster} alt={item.title}/>
        <div className="play" aria-hidden="true">▶</div>
        <div className="continue-play-badge">Продолжить</div>
        <div className="continue-info">
          <b>{item.title}</b>
          <span>Серия {item.episode}{item.voice ? ` · ${item.voice}` : ''}</span>
          <div className="bar"><i style={{width:`${Math.max(item.progress, 8)}%`}}/></div>
        </div>
        <em>{item.progress ? `${Math.round(item.progress)}%` : 'Плеер'}</em>
      </Link>)}
    </div>
  }, [loading, hasAccount, items])

  return content
}
