'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuthState } from '@/components/AuthStateClient'
import { getHistory } from '@/lib/userStorage'

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
    banner:imageSrc(item.banner || item.poster || item.poster_url),
    title:item.title || item.title_ru || item.name || 'Аниме',
    href:`/anime/${item.slug}?episode=${episode}#player`
  }
}

export default function RightContinueWatchingClient(){
  const { user, loading } = useAuthState()
  const [item, setItem] = useState(null)

  useEffect(() => {
    if(!user?.id){
      setItem(null)
      return undefined
    }
    const refresh = () => setItem(getHistory().map(normalizeHistoryItem).filter(Boolean)[0] || null)
    refresh()
    window.addEventListener('anime:user-updated', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('anime:user-updated', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [user?.id])

  if(loading) return <div className="widget watch"><div className="widget-head"><h3>▷ Продолжить просмотр</h3><Link href="/catalog">Каталог</Link></div><div className="watch-empty">Проверяем историю…</div></div>

  if(!user?.id){
    return <div className="widget watch"><div className="widget-head"><h3>▷ Продолжить просмотр</h3><Link href="/auth?next=/">Войти</Link></div><div className="watch-empty">Войди, чтобы история серий сохранялась между устройствами.</div></div>
  }

  if(!item){
    return <div className="widget watch"><div className="widget-head"><h3>▷ Продолжить просмотр</h3><Link href="/catalog">Каталог</Link></div><div className="watch-empty">История пока пустая. Открой тайтл и выбери серию.</div></div>
  }

  const progress = Math.max(item.progress || 0, 8)

  return <div className="widget watch">
    <div className="widget-head"><h3>▷ Продолжить просмотр</h3><Link href="/history">Смотреть все</Link></div>
    <Link className="watch-banner" href={item.href}>
      <img loading="lazy" decoding="async" src={item.banner || item.poster} alt={item.title}/>
      <div><b>{item.title}</b><span>Серия {item.episode}</span><div className="bar"><i style={{width:`${progress}%`}}/></div></div>
      <button type="button">▶</button>
    </Link>
  </div>
}
