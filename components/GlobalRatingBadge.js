'use client'

// AIanime v116: single solid-color community rating badge for cards.
import { useEffect, useMemo, useState } from 'react'
import { getRatings } from '@/lib/userStorage'

function normalizeScore(value){
  const score = Number(value || 0)
  return Number.isFinite(score) && score > 0 ? score : null
}

function scoreFromLocalRating(value){
  const rating = Number(value || 0)
  if(!Number.isFinite(rating) || rating <= 0) return null
  return rating * 2
}

function formatScore(value){
  const score = normalizeScore(value)
  if(!score) return ''
  return score.toFixed(1).replace('.0', '')
}

function toneClass(score){
  const value = Number(score || 0)
  if(!Number.isFinite(value) || value <= 0) return 'rating-tone-red'
  if(value >= 8.5) return 'rating-tone-gold'
  if(value >= 6.5) return 'rating-tone-orange'
  return 'rating-tone-red'
}

export default function GlobalRatingBadge({ slug, score = null, count = 0, className = '' }){
  const [localScore,setLocalScore] = useState(null)

  useEffect(() => {
    const update = (event) => {
      const eventSlug = event?.detail?.slug
      if(eventSlug && eventSlug !== slug) return
      const ratings = getRatings() || {}
      setLocalScore(scoreFromLocalRating(ratings?.[slug]))
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
  }, [slug])

  const serverScore = normalizeScore(score)
  const serverCount = Math.max(0, Number(count || 0) || 0)
  const visibleScore = localScore || (serverCount > 0 ? serverScore : null)
  const label = useMemo(() => formatScore(visibleScore), [visibleScore])

  if(!label) return null

  return <span className={`global-rating-badge ${toneClass(visibleScore)} ${className}`.trim()} title={`Рейтинг AIanime: ${label}/10`}>
    <span aria-hidden="true">★</span>
    <b>{label}</b>
  </span>
}
