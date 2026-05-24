'use client'

import { useEffect } from 'react'
import { saveHistoryItem } from '@/lib/userStorage'

export default function WatchTracker({ item, episode }){
  useEffect(()=>{
    saveHistoryItem(item, episode)
  }, [item.slug, episode])
  return null
}
