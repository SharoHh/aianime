'use client'

import { useEffect } from 'react'
import { useAuthState, restoreProfileFromCloud } from '@/components/AuthStateClient'
import { setUserSyncStatus } from '@/lib/userStorage'

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

        // Не запускаем массовую синхронизацию истории и библиотеки при каждом
        // открытии страницы. На старой схеме Supabase она порождала десятки
        // 400/404 и забивала соединения, из-за чего каталог мог не загрузиться.
        const result = await withTimeout(
          restoreProfileFromCloud(user, supabase).catch(() => null),
          2500,
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
        const message = String(error?.message || error?.details || '')
        if(/schema cache|Could not find|anime_slug|user_history/i.test(message)){
          setUserSyncStatus({ state:'idle', message:'Профиль работает. Синхронизация истории повторится автоматически.' })
          return
        }
        setUserSyncStatus({ state:'error', message:error?.message || 'Не удалось быстро загрузить данные аккаунта.' })
      }
    }

    idleTask = runWhenIdle(runInitialSync)


    return () => {
      cancelled = true
      if(idleTask) cancelIdleTask(idleTask)
      if(window.__AIANIME_ACCOUNT_SYNC_OWNER__ === ownerKey){
        delete window.__AIANIME_ACCOUNT_SYNC_OWNER__
      }
    }
  }, [configured, user?.id, supabase])

  return null
}
