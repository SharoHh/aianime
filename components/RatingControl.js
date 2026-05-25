'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getRatings, setUserRating } from '@/lib/userStorage'
import { pushToast } from '@/components/ToastCenter'
import { useAuthState } from '@/components/AuthStateClient'

function loginHref(){
  if(typeof window === 'undefined') return '/auth'
  return `/auth?next=${encodeURIComponent(window.location.pathname + window.location.hash)}`
}

export default function RatingControl({ slug }){
  const { user } = useAuthState()
  const [value,setValue] = useState(0)

  useEffect(()=>{
    const update = () => setValue(user ? Number(getRatings()[slug] || 0) : 0)
    update()
    window.addEventListener('storage', update)
    window.addEventListener('anime:user-updated', update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener('anime:user-updated', update)
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
    pushToast(valueToSave ? `Оценка сохранена: ${valueToSave}/5` : 'Оценка удалена', 'success')
  }

  return <div className="rating-control" aria-label="Оценка">
    {[1,2,3,4,5].map(n=><button type="button" key={n} onClick={()=>rate(n)} className={n<=value?'active':''}>★</button>)}
    {user ? <span>{value ? `Твоя оценка: ${value}/5` : 'Оценить'}</span> : <Link href={loginHref()}>Войти, чтобы оценить</Link>}
  </div>
}
