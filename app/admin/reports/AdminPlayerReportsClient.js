'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { pushToast } from '@/components/ToastCenter'

function statusLabel(status){
  if(status === 'checking') return 'Проверяем'
  if(status === 'fixed') return 'Исправлено'
  if(status === 'ignored') return 'Отклонено'
  return 'Открыто'
}

function formatDate(value){
  if(!value) return '—'
  try{ return new Date(value).toLocaleString('ru-RU') }catch{ return '—' }
}

export default function AdminPlayerReportsClient(){
  const [items,setItems] = useState([])
  const [status,setStatus] = useState('open')
  const [query,setQuery] = useState('')
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')

  async function load(){
    setLoading(true)
    setError('')
    try{
      const res = await fetch(`/api/admin/player-reports?status=${encodeURIComponent(status)}`, { cache:'no-store' })
      const data = await res.json().catch(() => null)
      if(!res.ok || !data?.ok) throw new Error(data?.error || 'Не удалось загрузить жалобы')
      setItems(data.reports || [])
    }catch(err){
      setItems([])
      setError(err?.message || 'Не удалось загрузить жалобы')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [status])

  const filteredItems = useMemo(() => {
    const clean = query.trim().toLowerCase()
    if(!clean) return items
    return items.filter(item => [item.slug, item.title, item.voice, item.reasonLabel, item.message, item.userEmail].some(value => String(value || '').toLowerCase().includes(clean)))
  }, [items, query])

  async function update(item, nextStatus){
    try{
      const res = await fetch('/api/admin/player-reports', {
        method:'PATCH',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ id:item.id, status:nextStatus, adminNote:item.adminNote || '' })
      })
      const data = await res.json().catch(() => null)
      if(!res.ok || !data?.ok) throw new Error(data?.error || 'Не удалось обновить жалобу')
      setItems(prev => prev.map(current => current.id === item.id ? { ...current, status:nextStatus } : current))
      pushToast('Статус жалобы обновлён', 'success')
    }catch(error){
      pushToast(error?.message || 'Жалоба не обновилась', 'error')
    }
  }

  async function remove(item){
    if(!window.confirm('Удалить жалобу?')) return
    try{
      const res = await fetch(`/api/admin/player-reports?id=${encodeURIComponent(item.id)}`, { method:'DELETE' })
      const data = await res.json().catch(() => null)
      if(!res.ok || !data?.ok) throw new Error(data?.error || 'Не удалось удалить жалобу')
      setItems(prev => prev.filter(current => current.id !== item.id))
      pushToast('Жалоба удалена', 'success')
    }catch(error){
      pushToast(error?.message || 'Жалоба не удалилась', 'error')
    }
  }

  return <section className="widget admin-edit-preview admin-player-reports-panel">
    <div className="admin-comments-toolbar-v25">
      <div>
        <b>Жалобы на плеер</b>
        <span>Открытые проблемы с сериями, озвучками и загрузкой видео.</span>
      </div>
      <button className="secondary" onClick={load} disabled={loading}>{loading ? 'Обновляем…' : 'Обновить'}</button>
    </div>

    <div className="admin-comments-filters-v25">
      {[
        ['all', 'Все'],
        ['open', 'Открытые'],
        ['checking', 'Проверяем'],
        ['fixed', 'Исправлено'],
        ['ignored', 'Отклонено']
      ].map(([value,label]) => <button key={value} className={status === value ? 'active' : ''} onClick={()=>setStatus(value)}>{label}</button>)}
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по тайтлу, slug, озвучке или тексту" />
    </div>

    {error ? <div className="admin-warning-v25"><b>Жалобы не загрузились</b><span>{error}</span></div> : null}

    {loading ? <div className="empty-state">Загружаем жалобы…</div> : filteredItems.length ? <div className="admin-simple-list admin-player-report-list">
      {filteredItems.map(item => <article key={item.id}>
        <div>
          <div className="admin-comment-title-row-v26">
            <b>{item.reasonLabel || 'Проблема с плеером'}</b>
            <span className={`admin-comment-status-v26 ${item.status || 'open'}`}>{statusLabel(item.status)}</span>
          </div>
          <Link className="admin-comment-anime-link-v26" href={`/anime/${item.slug}#player`}>{item.title || item.slug}</Link>
          <span>Серия: {item.episode || '—'}{item.voice ? ` · ${item.voice}` : ''}</span>
          {item.message ? <p>{item.message}</p> : null}
          <em>{formatDate(item.createdAt)} · {item.userEmail || item.userName || item.clientId || 'гость'} · {item.slug}</em>
        </div>
        <div className="admin-comment-actions-v25">
          <Link href={`/anime/${item.slug}#player`}>Открыть тайтл</Link>
          {item.status !== 'open' ? <button onClick={()=>update(item, 'open')}>Открыть</button> : null}
          {item.status !== 'checking' ? <button onClick={()=>update(item, 'checking')}>Проверяем</button> : null}
          {item.status !== 'fixed' ? <button onClick={()=>update(item, 'fixed')}>Исправлено</button> : null}
          {item.status !== 'ignored' ? <button onClick={()=>update(item, 'ignored')}>Отклонить</button> : null}
          <button onClick={()=>remove(item)}>Удалить</button>
        </div>
      </article>)}
    </div> : <div className="empty-state">Жалоб пока нет.</div>}
  </section>
}
