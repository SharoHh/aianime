'use client'

import { useEffect } from 'react'
import { useAuthState } from '@/components/AuthStateClient'
import { restoreCloudAnimeData, syncLocalAnimeDataToCloud } from '@/lib/userStorage'
import { restoreProfileFromCloud } from '@/components/AuthStateClient'

export default function AccountSyncClient(){
  const { configured, user, supabase } = useAuthState()

  useEffect(()=>{
    if(!configured || !user || !supabase || typeof window === 'undefined') return undefined

    let cancelled = false
    const key = `anime:cloud-sync-ready:${user.id}`

    async function runInitialSync(){
      try{
        // На каждом старте аккуратно подтягиваем облако и потом дописываем локальные изменения.
        // Так избранное/история/оценки не теряются между браузерами и после выхода/входа.
        await Promise.all([
          restoreCloudAnimeData(),
          restoreProfileFromCloud(user, supabase).catch(() => null)
        ])
        localStorage.setItem(key, '1')
      }catch{}
    }

    runInitialSync()

    let timer = null
    const onUserUpdate = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if(!cancelled) syncLocalAnimeDataToCloud().catch(() => {})
      }, 900)
    }

    window.addEventListener('anime:user-updated', onUserUpdate)
    window.addEventListener('storage', onUserUpdate)

    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener('anime:user-updated', onUserUpdate)
      window.removeEventListener('storage', onUserUpdate)
    }
  }, [configured, user, supabase])

  return null
}
