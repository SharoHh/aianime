'use client'

import { useEffect, useState } from 'react'
import { getUserSyncStatus } from '@/lib/userStorage'

function label(state){
  if(state === 'syncing') return 'Синхронизация'
  if(state === 'error') return 'Локально'
  if(state === 'ok') return 'Сохранено'
  return 'Аккаунт'
}

export default function UserSyncStatusClient(){
  const [status,setStatus] = useState(() => getUserSyncStatus())

  useEffect(()=>{
    const update = event => setStatus(event?.detail || getUserSyncStatus())
    window.addEventListener('anime:user-sync-status', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener('anime:user-sync-status', update)
      window.removeEventListener('storage', update)
    }
  }, [])

  let state = status?.state || 'idle'
  let message = status?.message || 'Избранное, история, оценки и профиль сохраняются в аккаунте.'

  if(state === 'syncing' && status?.updatedAt){
    const startedAt = new Date(status.updatedAt).getTime()
    if(Number.isFinite(startedAt) && Date.now() - startedAt > 12000){
      state = 'idle'
      message = 'Данные аккаунта загрузятся в фоне. Можно пользоваться сайтом.'
    }
  }

  return <div className={`user-sync-status user-sync-status-${state}`}>
    <span>{label(state)}</span>
    <p>{message}</p>
  </div>
}
