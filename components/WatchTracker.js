'use client'

import { useEffect } from 'react'
import { saveHistoryItem } from '@/lib/userStorage'
import { useAuthState } from '@/components/AuthStateClient'

export default function WatchTracker({ item, episode }){
  const { user } = useAuthState()

  useEffect(()=>{
    if(!user) return
    saveHistoryItem(item, episode)
  }, [item.slug, episode, user?.id])

  return null
}
