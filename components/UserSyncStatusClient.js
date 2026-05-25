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

  const state = status?.state || 'idle'
  const message = status?.message || 'Избранное, история, оценки и профиль сохраняются в аккаунте.'

  return <div className={`user-sync-status user-sync-status-${state}`}>
    <span>{label(state)}</span>
    <p>{message}</p>
  </div>
}
