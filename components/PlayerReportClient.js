'use client'

import { useMemo, useState } from 'react'
import { pushToast } from '@/components/ToastCenter'
import { useAuthState } from '@/components/AuthStateClient'

const CLIENT_ID_KEY = 'anime:player-report-client-id'

const reasons = [
  ['not_loading', 'Видео не грузится'],
  ['wrong_episode', 'Не та серия'],
  ['wrong_voice', 'Не та озвучка'],
  ['bad_quality', 'Плохое качество'],
  ['other', 'Другая проблема']
]

function getClientId(){
  if(typeof window === 'undefined') return ''
  try{
    let id = window.localStorage.getItem(CLIENT_ID_KEY)
    if(!id){
      id = `browser-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
      window.localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  }catch{
    return `ephemeral-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }
}

export default function PlayerReportClient({ slug, title, episode = 1, voice = '' }){
  const { user, supabase } = useAuthState()
  const [reason,setReason] = useState('not_loading')
  const [message,setMessage] = useState('')
  const [saving,setSaving] = useState(false)
  const [sent,setSent] = useState(false)

  const reasonLabel = useMemo(() => reasons.find(item => item[0] === reason)?.[1] || 'Проблема с плеером', [reason])

  async function submit(e){
    e.preventDefault()
    if(saving) return
    setSaving(true)
    try{
      let token = ''
      if(supabase){
        try{
          const { data } = await supabase.auth.getSession()
          token = data?.session?.access_token || ''
        }catch{}
      }

      const res = await fetch('/api/player-reports', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          ...(token ? { Authorization:`Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          slug,
          title,
          episode,
          voice,
          reason,
          reasonLabel,
          message,
          clientId:getClientId(),
          pageUrl: typeof window !== 'undefined' ? window.location.href : ''
        })
      })
      const data = await res.json().catch(() => null)
      if(!res.ok || !data?.ok) throw new Error(data?.error || 'Не удалось отправить жалобу')
      setSent(true)
      setMessage('')
      pushToast('Жалоба отправлена. Проверим плеер.', 'success')
    }catch(error){
      pushToast(error?.message || 'Жалоба не отправилась', 'error')
    }finally{
      setSaving(false)
    }
  }

  return <details className="player-report-box" data-aianime-player-report="v162">
    <summary>
      <span>Проблема с плеером?</span>
      <em>{sent ? 'Отправлено' : 'Сообщить'}</em>
    </summary>
    <form onSubmit={submit} className="player-report-form">
      <div className="player-report-meta">
        <span>Серия {Math.max(1, Number(episode || 1) || 1)}</span>
        {voice ? <span>{voice}</span> : null}
        {user ? <span>аккаунт привязан</span> : <span>можно без входа</span>}
      </div>
      <label>
        <span>Что случилось</span>
        <select value={reason} onChange={e=>setReason(e.target.value)}>
          {reasons.map(([value,label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </label>
      <label>
        <span>Комментарий, если нужно</span>
        <textarea
          value={message}
          onChange={e=>setMessage(e.target.value)}
          maxLength={500}
          placeholder="Например: серия не открывается, чёрный экран, не та озвучка..."
        />
      </label>
      <button type="submit" disabled={saving}>{saving ? 'Отправляем…' : 'Отправить жалобу'}</button>
    </form>
  </details>
}
