'use client'

// AIanime v106: Yummy-like compact global rating strip, no duplicate personal badge/title.
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getRatings, setUserRating } from '@/lib/userStorage'
import { pushToast } from '@/components/ToastCenter'
import { useAuthState } from '@/components/AuthStateClient'

function loginHref(){
  if(typeof window === 'undefined') return '/auth'
  return `/auth?next=${encodeURIComponent(window.location.pathname + window.location.hash)}`
}

function displayScoreFromFive(value){
  const rating = Number(value || 0)
  if(!Number.isFinite(rating) || rating <= 0) return '—'
  return (rating * 2).toFixed(1).replace('.0', '')
}

function displayScoreFromTen(value){
  const rating = Number(value || 0)
  if(!Number.isFinite(rating) || rating <= 0) return '—'
  return rating.toFixed(1).replace('.0', '')
}

function ratingCountLabel(count){
  const number = Math.max(0, Number(count || 0) || 0)
  const mod10 = number % 10
  const mod100 = number % 100
  if(mod10 === 1 && mod100 !== 11) return `${number} оценка`
  if(mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${number} оценки`
  return `${number} оценок`
}

function globalSummary(siteRating, localValue, baseScore){
  const communityValue = Number(siteRating?.value || 0)
  const communityCount = Number(siteRating?.count || 0)
  const local = Number(localValue || 0)
  const fallback = Number(baseScore || 0)

  if(communityCount > 0 && Number.isFinite(communityValue) && communityValue > 0){
    return { score:displayScoreFromFive(communityValue), label:ratingCountLabel(communityCount) }
  }
  if(local > 0){
    return { score:displayScoreFromFive(local), label:'1 оценка' }
  }
  if(Number.isFinite(fallback) && fallback > 0){
    return { score:displayScoreFromTen(fallback), label:'рейтинг источников' }
  }
  return { score:'—', label:'нет оценок' }
}

function normalizeSource(item){
  const label = String(item?.label || '').trim()
  const score = displayScoreFromTen(item?.score)
  if(!label || score === '—') return null
  return { label, score, href:item?.href || '' }
}

export default function RatingControl({ slug, siteRating = null, baseScore = null, sources = [] }){
  const { user } = useAuthState()
  const [value,setValue] = useState(0)
  const summary = useMemo(() => globalSummary(siteRating, value, baseScore), [siteRating, value, baseScore])
  const sourceItems = useMemo(() => (Array.isArray(sources) ? sources : []).map(normalizeSource).filter(Boolean), [sources])

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
      pushToast('Войди в аккаунт, чтобы оценивать тайтлы.', 'error')
      return
    }
    const valueToSave = value === next ? 0 : next
    const ok = setUserRating(slug, valueToSave)
    if(!ok){
      pushToast('Войди в аккаунт, чтобы оценивать тайтлы.', 'error')
      return
    }
    setValue(valueToSave)
    try{ window.dispatchEvent(new CustomEvent('anime:rating-updated', { detail:{ slug, value:valueToSave } })) }catch{}
    pushToast(valueToSave ? `Оценка сохранена: ${displayScoreFromFive(valueToSave)}/10` : 'Оценка удалена', 'success')
  }

  return <section className="title-rating-strip title-rating-strip-v106" aria-label="Рейтинг">
    <div className="title-rating-main-score" title="Рейтинг AIanime">
      <span>★</span>
      <b>{summary.score}</b>
      <em>{summary.label}</em>
    </div>

    {sourceItems.length ? <div className="title-rating-source-list" aria-label="Рейтинги на внешних сервисах">
      {sourceItems.map(source => source.href
        ? <a key={source.label} href={source.href} target="_blank" rel="noopener noreferrer" className="title-rating-source-chip" title={`${source.label}: ${source.score}`}>{source.label}<b>{source.score}</b></a>
        : <span key={source.label} className="title-rating-source-chip" title={`${source.label}: ${source.score}`}>{source.label}<b>{source.score}</b></span>
      )}
    </div> : null}

    <div className="title-rating-vote" aria-label="Поставить оценку">
      <div className="rating-control" role="group" aria-label="Поставить оценку">
        {[1,2,3,4,5].map(n=><button type="button" key={n} onClick={()=>rate(n)} className={n<=value?'active':''} aria-pressed={n<=value} title={`${n * 2}/10`}>★</button>)}
      </div>
      {!user ? <Link href={loginHref()} className="rating-login-link">Войти</Link> : null}
    </div>
  </section>
}
