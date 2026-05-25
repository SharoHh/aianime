'use client'

import { useEffect, useState } from 'react'
import { getRatings, setUserRating } from '@/lib/userStorage'
import { pushToast } from '@/components/ToastCenter'

export default function RatingControl({ slug }){
  const [value,setValue] = useState(0)

  useEffect(()=>{
    const update = () => setValue(Number(getRatings()[slug] || 0))
    update()
    window.addEventListener('storage', update)
    window.addEventListener('anime:user-updated', update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener('anime:user-updated', update)
    }
  }, [slug])

  function rate(next){
    const valueToSave = value === next ? 0 : next
    setValue(valueToSave)
    setUserRating(slug, valueToSave)
    pushToast(valueToSave ? `Оценка сохранена: ${valueToSave}/5` : 'Оценка удалена', 'success')
  }

  return <div className="rating-control" aria-label="Оценка">
    {[1,2,3,4,5].map(n=><button type="button" key={n} onClick={()=>rate(n)} className={n<=value?'active':''}>★</button>)}
    <span>{value ? `Твоя оценка: ${value}/5` : 'Оценить'}</span>
  </div>
}
