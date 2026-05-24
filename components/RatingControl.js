'use client'

import { useEffect, useState } from 'react'
import { getRatings, setUserRating } from '@/lib/userStorage'
import { pushToast } from '@/components/ToastCenter'

export default function RatingControl({ slug }){
  const [value,setValue] = useState(0)

  useEffect(()=>{
    setValue(Number(getRatings()[slug] || 0))
  }, [slug])

  function rate(next){
    setValue(next)
    setUserRating(slug, next)
    pushToast(`Оценка сохранена: ${next}/5`, 'success')
  }

  return <div className="rating-control" aria-label="Оценка">
    {[1,2,3,4,5].map(n=><button type="button" key={n} onClick={()=>rate(n)} className={n<=value?'active':''}>★</button>)}
    <span>{value ? `Твоя оценка: ${value}/5` : 'Оценить'}</span>
  </div>
}
