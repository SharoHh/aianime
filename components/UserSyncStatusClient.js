'use client'

import { useEffect, useState } from 'react'
import { getUserSyncStatus, setUserSyncStatus } from '@/lib/userStorage'


function isOldSchemaMessage(message){
  return /anime_slug|user_history|schema cache|обновить миграцией|миграц/i.test(String(message || ''))
}

function normalizeVisibleStatus(status){
  if(isOldSchemaMessage(status?.message)){
    return { state:'idle', message:'Профиль работает. Синхронизация истории проверяется в фоне.', updatedAt:status?.updatedAt || null }
  }
  return status
}

function label(state){
  if(state === 'syncing') return 'Синхронизация'
  if(state === 'error') return 'Локально'
  if(state === 'ok') return 'Сохранено'
  return 'Аккаунт'
}

export default function UserSyncStatusClient(){
  const [status,setStatus] = useState(() => {
    const current = normalizeVisibleStatus(getUserSyncStatus())
    if(current?.state === 'syncing' && current?.updatedAt){
      const startedAt = new Date(current.updatedAt).getTime()
      if(Number.isFinite(startedAt) && Date.now() - startedAt > 4500){
        return { ...current, state:'idle', message:'Данные аккаунта обновляются в фоне. Можно пользоваться сайтом.' }
      }
    }
    return current
  })

  useEffect(()=>{
    const current = getUserSyncStatus()
    if(isOldSchemaMessage(current?.message)){
      setUserSyncStatus({ state:'idle', message:'Профиль работает. Синхронизация истории проверяется в фоне.' })
    }
    const update = event => setStatus(normalizeVisibleStatus(event?.detail || getUserSyncStatus()))
    window.addEventListener('anime:user-sync-status', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener('anime:user-sync-status', update)
      window.removeEventListener('storage', update)
    }
  }, [])

  let state = status?.state || 'idle'
  let message = normalizeVisibleStatus(status)?.message || 'Избранное, история, оценки и профиль сохраняются в аккаунте.'

  if(state === 'syncing' && status?.updatedAt){
    const startedAt = new Date(status.updatedAt).getTime()
    if(Number.isFinite(startedAt) && Date.now() - startedAt > 4500){
      state = 'idle'
      message = 'Данные аккаунта обновляются в фоне. Можно пользоваться сайтом.'
    }
  }

  return <div className={`user-sync-status user-sync-status-${state}`}>
    <span>{label(state)}</span>
    <p>{message}</p>
  </div>
}
