'use client'

import { useEffect, useState } from 'react'
import { getRatings } from '@/lib/userStorage'

function displayScore(value){
  const rating = Number(value || 0)
  if(!Number.isFinite(rating) || rating <= 0) return ''
  return (rating * 2).toFixed(1).replace('.0', '')
}

export default function UserRatingBadge({ slug, compact = false }){
  const [value, setValue] = useState(0)

  useEffect(() => {
    if(!slug) return undefined
    const update = () => setValue(Number(getRatings()?.[slug] || 0))
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

  const score = displayScore(value)
  if(!score) return null

  return <span className={compact ? 'user-rating-badge compact' : 'user-rating-badge'} title={`Твоя оценка: ${score}/10`}>
    <span>★</span>{compact ? score : `Твоя ${score}`}
  </span>
}
