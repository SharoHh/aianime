'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getRatings, setUserRating } from '@/lib/userStorage'
import { pushToast } from '@/components/ToastCenter'
import { useAuthState } from '@/components/AuthStateClient'

function loginHref(){
  if(typeof window === 'undefined') return '/auth'
  return `/auth?next=${encodeURIComponent(window.location.pathname + window.location.hash)}`
}

function displayScore(value){
  const rating = Number(value || 0)
  if(!Number.isFinite(rating) || rating <= 0) return '—'
  return (rating * 2).toFixed(1).replace('.0', '')
}

function averageScore(siteRating, ownValue){
  const value = Number(siteRating?.value || 0)
  const count = Number(siteRating?.count || 0)
  const own = Number(ownValue || 0)
  if(count > 0 && Number.isFinite(value) && value > 0){
    return { score:displayScore(value), count }
  }
  if(own > 0) return { score:displayScore(own), count:1 }
  return { score:'—', count:0 }
}

export default function RatingControl({ slug, siteRating = null }){
  const { user } = useAuthState()
  const [value,setValue] = useState(0)
  const summary = useMemo(() => averageScore(siteRating, value), [siteRating, value])

  useEffect(()=>{
    const update = () => setValue(user ? Number(getRatings()[slug] || 0) : 0)
    update()
    window.addEventListener('storage', update)
    window.addEventListener('anime:user-updated', update)
    window.addEventListener('anime:rating-updated', update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener('anime:user-updated', update)
      window.removeEventListener('anime:rating-updated', update)
    }
  }, [slug, user?.id])

  function rate(next){
    if(!user){
      pushToast('Войди в аккаунт, чтобы ставить оценки.', 'error')
      return
    }
    const valueToSave = value === next ? 0 : next
    const ok = setUserRating(slug, valueToSave)
    if(!ok){
      pushToast('Войди в аккаунт, чтобы ставить оценки.', 'error')
      return
    }
    setValue(valueToSave)
    try{ window.dispatchEvent(new CustomEvent('anime:rating-updated', { detail:{ slug, value:valueToSave } })) }catch{}
    pushToast(valueToSave ? `Оценка сохранена: ${displayScore(valueToSave)}/10` : 'Оценка удалена', 'success')
  }

  return <section className="title-rating-panel" aria-label="Оценка тайтла">
    <div className="title-rating-panel__summary">
      <span>Наш рейтинг</span>
      <b>{summary.score}</b>
      <em>{summary.count ? `${summary.count} оценок` : 'пока нет оценок'}</em>
    </div>
    <div className="title-rating-panel__control">
      <span>{user ? (value ? `Твоя оценка: ${displayScore(value)}/10` : 'Поставь оценку') : 'Войди, чтобы оценить'}</span>
      <div className="rating-control" role="group" aria-label="Поставить оценку">
        {[1,2,3,4,5].map(n=><button type="button" key={n} onClick={()=>rate(n)} className={n<=value?'active':''} aria-pressed={n<=value}>★</button>)}
      </div>
      {!user ? <Link href={loginHref()} className="rating-login-link">Войти</Link> : null}
    </div>
  </section>
}
