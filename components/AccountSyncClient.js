'use client'

import { useEffect } from 'react'
import { useAuthState, restoreProfileFromCloud } from '@/components/AuthStateClient'
import { restoreCloudAnimeData, setUserSyncStatus, syncLocalAnimeDataToCloud } from '@/lib/userStorage'

function runWhenIdle(callback){
  if(typeof window === 'undefined') return setTimeout(callback, 250)
  if('requestIdleCallback' in window){
    return window.requestIdleCallback(callback, { timeout:1200 })
  }
  return setTimeout(callback, 250)
}

function cancelIdleTask(id){
  if(typeof window !== 'undefined' && 'cancelIdleCallback' in window && typeof id === 'number'){
    window.cancelIdleCallback(id)
    return
  }
  clearTimeout(id)
}

function withTimeout(promise, ms, fallback){
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms))
  ])
}

export default function AccountSyncClient(){
  const { configured, user, supabase } = useAuthState()

  useEffect(()=>{
    if(typeof window === 'undefined') return undefined

    if(!configured || !user || !supabase){
      setUserSyncStatus({ state:'idle', message:'Войди в аккаунт, чтобы сохранять избранное, историю и оценки.' })
      return undefined
    }

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

        if(freshEnough){
          setUserSyncStatus({ state:'ok', message:'Данные аккаунта уже загружены.' })
          return
        }

        setUserSyncStatus({ state:'idle', message:'Данные аккаунта обновляются в фоне. Можно пользоваться сайтом.' })

        const result = await withTimeout(
          Promise.all([
            restoreCloudAnimeData({ silent:true }),
            restoreProfileFromCloud(user, supabase).catch(() => null)
          ]),
          3500,
          { timedOut:true }
        )

        if(cancelled) return
        localStorage.setItem(readyKey, '1')
        localStorage.setItem(lastRunKey, String(Date.now()))

        if(result?.timedOut){
          setUserSyncStatus({ state:'idle', message:'Supabase отвечает долго. Данные обновятся в фоне.' })
          return
        }

        setUserSyncStatus({ state:'ok', message:'Данные аккаунта загружены.' })
      }catch(error){
        if(cancelled) return
        setUserSyncStatus({ state:'error', message:error?.message || 'Не удалось быстро загрузить данные аккаунта.' })
      }
    }

    idleTask = runWhenIdle(runInitialSync)

    const onUserUpdate = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if(!cancelled) syncLocalAnimeDataToCloud().catch(() => {})
      }, 1600)
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
