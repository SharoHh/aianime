'use client'

// AIanime v108: instant community rating update + strict external source ratings.
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

function normalizeSiteRating(siteRating){
  const value = Number(siteRating?.value || 0)
  const count = Math.max(0, Number(siteRating?.count || 0) || 0)
  return {
    value: Number.isFinite(value) && value > 0 ? value : null,
    count
  }
}

function applyOptimisticVote(currentRating, previousValue, nextValue){
  const previous = Math.max(0, Number(previousValue || 0) || 0)
  const next = Math.max(0, Number(nextValue || 0) || 0)
  let count = Math.max(0, Number(currentRating?.count || 0) || 0)
  let value = Number(currentRating?.value || 0)

  if(!Number.isFinite(value) || value <= 0){
    value = previous > 0 ? previous : 0
    if(previous > 0 && count < 1) count = 1
  }

  if(previous > 0 && next > 0){
    if(count < 1) count = 1
    value = ((value * count) - previous + next) / count
  }else if(previous > 0 && next <= 0){
    if(count <= 1) return { value:null, count:0 }
    value = ((value * count) - previous) / (count - 1)
    count -= 1
  }else if(previous <= 0 && next > 0){
    value = ((value * count) + next) / (count + 1)
    count += 1
  }

  if(!Number.isFinite(value) || value <= 0 || count <= 0) return { value:null, count:0 }
  return { value, count }
}

function globalSummary(siteRating){
  const communityValue = Number(siteRating?.value || 0)
  const communityCount = Number(siteRating?.count || 0)

  if(communityCount > 0 && Number.isFinite(communityValue) && communityValue > 0){
    return { score:displayScoreFromFive(communityValue), label:ratingCountLabel(communityCount) }
  }

  // Не подставляем MAL/Shiki/старый score как рейтинг AIanime.
  // Пока пользователи не поставили оценки, общий рейтинг сайта должен быть пустым.
  return { score:'—', label:'0 оценок' }
}

function sourceLogo(label, explicitLogo){
  const logo = String(explicitLogo || '').trim()
  if(logo) return logo
  const key = String(label || '').toLowerCase()
  if(key.includes('mal') || key.includes('myanimelist')) return 'MAL'
  if(key.includes('shiki') || key.includes('shikimori')) return '鳥居'
  return String(label || '').slice(0, 3).toUpperCase()
}

function sourceClass(label){
  const key = String(label || '').toLowerCase()
  if(key.includes('mal') || key.includes('myanimelist')) return ' mal'
  if(key.includes('shiki') || key.includes('shikimori')) return ' shiki'
  return ''
}

function normalizeSource(item){
  const label = String(item?.label || '').trim()
  const score = displayScoreFromTen(item?.score)
  if(!label || score === '—') return null
  return { label, logo:sourceLogo(label, item?.logo), cls:sourceClass(label), score, href:item?.href || '' }
}

export default function RatingControl({ slug, siteRating = null, sources = [] }){
  const { user } = useAuthState()
  const [value,setValue] = useState(0)
  const [optimisticSiteRating,setOptimisticSiteRating] = useState(() => normalizeSiteRating(siteRating))
  const summary = useMemo(() => globalSummary(optimisticSiteRating), [optimisticSiteRating])
  const sourceItems = useMemo(() => (Array.isArray(sources) ? sources : []).map(normalizeSource).filter(Boolean), [sources])

  useEffect(()=>{
    setOptimisticSiteRating(normalizeSiteRating(siteRating))
  }, [siteRating?.value, siteRating?.count])

  useEffect(()=>{
    const update = () => {
      const storedValue = user ? Number(getRatings()[slug] || 0) : 0
      setValue(storedValue)
      // Если пользователь уже поставил оценку локально, но Supabase ещё не вернул
      // обновлённый общий рейтинг, показываем его сразу без перезагрузки страницы.
      if(user && storedValue > 0){
        setOptimisticSiteRating(current => current?.count > 0 ? current : { value:storedValue, count:1 })
      }
    }
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
    const previousValue = value
    const valueToSave = value === next ? 0 : next
    const ok = setUserRating(slug, valueToSave)
    if(!ok){
      pushToast('Войди в аккаунт, чтобы оценивать тайтлы.', 'error')
      return
    }
    setValue(valueToSave)
    setOptimisticSiteRating(current => applyOptimisticVote(current, previousValue, valueToSave))
    try{ window.dispatchEvent(new CustomEvent('anime:rating-updated', { detail:{ slug, value:valueToSave } })) }catch{}
    pushToast(valueToSave ? `Оценка сохранена: ${displayScoreFromFive(valueToSave)}/10` : 'Оценка удалена', 'success')
  }

  return <section className="title-rating-strip title-rating-strip-v107 title-rating-strip-v108" aria-label="Рейтинг">
    <div className="title-rating-main-score" title="Рейтинг AIanime">
      <span>★</span>
      <b>{summary.score}</b>
      <em>{summary.label}</em>
    </div>

    {sourceItems.length ? <div className="title-rating-source-list" aria-label="Рейтинги на внешних сервисах">
      {sourceItems.map(source => source.href
        ? <a key={source.label} href={source.href} target="_blank" rel="noopener noreferrer" className={`title-rating-source-chip${source.cls}`} title={`${source.label}: ${source.score}`}>
            <span className="title-rating-source-logo" aria-hidden="true">{source.logo}</span>
            <span className="sr-only">{source.label}</span>
            <b>{source.score}</b>
          </a>
        : <span key={source.label} className={`title-rating-source-chip${source.cls}`} title={`${source.label}: ${source.score}`}>
            <span className="title-rating-source-logo" aria-hidden="true">{source.logo}</span>
            <span className="sr-only">{source.label}</span>
            <b>{source.score}</b>
          </span>
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
