'use client'

import { useEffect } from 'react'
import { useAuthState } from '@/components/AuthStateClient'
import { restoreCloudAnimeData, syncLocalAnimeDataToCloud } from '@/lib/userStorage'
import { restoreProfileFromCloud } from '@/components/AuthStateClient'

function runWhenIdle(callback){
  if(typeof window === 'undefined') return setTimeout(callback, 250)
  if('requestIdleCallback' in window){
    return window.requestIdleCallback(callback, { timeout:1800 })
  }
  return setTimeout(callback, 450)
}

function cancelIdleTask(id){
  if(typeof window !== 'undefined' && 'cancelIdleCallback' in window && typeof id === 'number'){
    window.cancelIdleCallback(id)
    return
  }
  clearTimeout(id)
}

export default function AccountSyncClient(){
  const { configured, user, supabase } = useAuthState()

  useEffect(()=>{
    if(!configured || !user || !supabase || typeof window === 'undefined') return undefined

    // В layout уже есть глобальный AccountSyncClient. Если компонент случайно
    // смонтирован повторно, не запускаем вторую пачку запросов к Supabase.
    const ownerKey = `anime:account-sync-owner:${user.id}`
    if(window.__AIANIME_ACCOUNT_SYNC_OWNER__ && window.__AIANIME_ACCOUNT_SYNC_OWNER__ !== ownerKey){
      return undefined
    }
    window.__AIANIME_ACCOUNT_SYNC_OWNER__ = ownerKey

    let cancelled = false
    let timer = null
    let idleTask = null
    const readyKey = `anime:cloud-sync-ready:${user.id}`
    const lastRunKey = `anime:cloud-sync-last-run:${user.id}`

    async function runInitialSync(){
      try{
        if(cancelled) return
        const lastRun = Number(localStorage.getItem(lastRunKey) || 0)
        const freshEnough = Date.now() - lastRun < 5 * 60 * 1000

        // После входа UI открывается сразу. Облако подтягиваем в idle/background,
        // чтобы авторизация и выход не ощущались тормозными.
        await Promise.all([
          freshEnough ? Promise.resolve({ ok:true, cached:true }) : restoreCloudAnimeData(),
          restoreProfileFromCloud(user, supabase).catch(() => null)
        ])
        if(cancelled) return
        localStorage.setItem(readyKey, '1')
        localStorage.setItem(lastRunKey, String(Date.now()))
      }catch{}
    }

    idleTask = runWhenIdle(runInitialSync)

    const onUserUpdate = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if(!cancelled) syncLocalAnimeDataToCloud().catch(() => {})
      }, 1400)
    }

    window.addEventListener('anime:user-updated', onUserUpdate)
    window.addEventListener('storage', onUserUpdate)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if(idleTask) cancelIdleTask(idleTask)
      window.removeEventListener('anime:user-updated', onUserUpdate)
      window.removeEventListener('storage', onUserUpdate)
      if(window.__AIANIME_ACCOUNT_SYNC_OWNER__ === ownerKey){
        delete window.__AIANIME_ACCOUNT_SYNC_OWNER__
      }
    }
  }, [configured, user?.id, supabase])

  return null
}
