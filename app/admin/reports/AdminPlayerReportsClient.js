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

const filters = [
  ['all', 'Все'],
  ['open', 'Открытые'],
  ['checking', 'Проверяем'],
  ['fixed', 'Исправлено'],
  ['ignored', 'Отклонено']
]

export default function AdminPlayerReportsClient(){
  const [items,setItems] = useState([])
  const [summary,setSummary] = useState({ all:0, open:0, checking:0, fixed:0, ignored:0 })
  const [status,setStatus] = useState('open')
  const [query,setQuery] = useState('')
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [notes,setNotes] = useState({})

  async function load(){
    setLoading(true)
    setError('')
    try{
      const res = await fetch('/admin/api/player-reports?status=all', { cache:'no-store' })
      const data = await res.json().catch(() => null)
      if(!res.ok || !data?.ok) throw new Error(data?.error || 'Не удалось загрузить жалобы')
      const reports = data.reports || []
      setItems(reports)
      setSummary(data.summary || { all:reports.length })
      setNotes(Object.fromEntries(reports.map(item => [item.id, item.adminNote || ''])))
    }catch(err){
      setItems([])
      setSummary({ all:0, open:0, checking:0, fixed:0, ignored:0 })
      setError(err?.message || 'Не удалось загрузить жалобы')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [])


  const computedSummary = useMemo(() => items.reduce((acc, item) => {
    const key = item.status || 'open'
    acc[key] = (acc[key] || 0) + 1
    acc.all = (acc.all || 0) + 1
    return acc
  }, { all:0, open:0, checking:0, fixed:0, ignored:0 }), [items])

  const filteredItems = useMemo(() => {
    const clean = query.trim().toLowerCase()
    return items.filter(item => {
      if(status !== 'all' && (item.status || 'open') !== status) return false
      if(!clean) return true
      return [
        item.slug,
        item.title,
        item.voice,
        item.reasonLabel,
        item.message,
        item.userEmail,
        item.userName,
        item.clientId,
        item.adminNote
      ].some(value => String(value || '').toLowerCase().includes(clean))
    })
  }, [items, query, status])

  async function update(item, nextStatus = item.status){
    try{
      const adminNote = notes[item.id] ?? item.adminNote ?? ''
      const res = await fetch('/admin/api/player-reports', {
        method:'PATCH',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ id:item.id, status:nextStatus, adminNote })
      })
      const data = await res.json().catch(() => null)
      if(!res.ok || !data?.ok) throw new Error(data?.error || 'Не удалось обновить жалобу')
      setItems(prev => prev.map(current => current.id === item.id ? { ...current, status:nextStatus, adminNote } : current))
      pushToast('Жалоба обновлена', 'success')
    }catch(error){
      pushToast(error?.message || 'Жалоба не обновилась', 'error')
    }
  }

  async function remove(item){
    if(!window.confirm('Удалить жалобу?')) return
    try{
      const res = await fetch(`/admin/api/player-reports?id=${encodeURIComponent(item.id)}`, { method:'DELETE' })
      const data = await res.json().catch(() => null)
      if(!res.ok || !data?.ok) throw new Error(data?.error || 'Не удалось удалить жалобу')
      setItems(prev => prev.filter(current => current.id !== item.id))
      pushToast('Жалоба удалена', 'success')
    }catch(error){
      pushToast(error?.message || 'Жалоба не удалилась', 'error')
    }
  }

  return <section className="widget admin-edit-preview admin-player-reports-panel admin-player-reports-v168">
    <div className="admin-comments-toolbar-v25">
      <div>
        <b>Жалобы на плеер</b>
        <span>Проблемы с сериями, озвучками и загрузкой видео. Быстро открывай тайтл и отмечай статус.</span>
      </div>
      <button className="secondary" onClick={load} disabled={loading}>{loading ? 'Обновляем…' : 'Обновить'}</button>
    </div>

    <div className="admin-report-status-grid-v168">
      {filters.map(([value,label]) => <button key={value} className={status === value ? 'active' : ''} onClick={()=>setStatus(value)}>
        <span>{label}</span>
        <b>{computedSummary[value] ?? 0}</b>
      </button>)}
    </div>

    <div className="admin-comments-filters-v25">
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по тайтлу, slug, озвучке, пользователю или тексту" />
    </div>

    {error ? <div className="admin-warning-v25"><b>Жалобы не загрузились</b><span>{error}</span></div> : null}

    {loading ? <div className="empty-state">Загружаем жалобы…</div> : filteredItems.length ? <div className="admin-simple-list admin-player-report-list admin-player-report-list-v168">
      {filteredItems.map(item => <article key={item.id}>
        <div>
          <div className="admin-comment-title-row-v26">
            <b>{item.reasonLabel || 'Проблема с плеером'}</b>
            <span className={`admin-comment-status-v26 ${item.status || 'open'}`}>{statusLabel(item.status)}</span>
          </div>
          <Link className="admin-comment-anime-link-v26" href={`/anime/${item.slug}?episode=${item.episode || 1}${item.voice ? `&voice=${encodeURIComponent(item.voice)}` : ''}#player`}>{item.title || item.slug}</Link>
          <span>Серия: {item.episode || '—'}{item.voice ? ` · ${item.voice}` : ''}</span>
          {item.message ? <p>{item.message}</p> : null}
          <em>{formatDate(item.createdAt)} · {item.userEmail || item.userName || item.clientId || 'гость'} · {item.slug}</em>
          <label className="admin-report-note-v168">
            <span>Заметка админа</span>
            <textarea value={notes[item.id] ?? ''} onChange={e=>setNotes(prev => ({ ...prev, [item.id]:e.target.value }))} placeholder="Например: серия проверена, ждём Kodik, дубль жалобы..." />
          </label>
        </div>
        <div className="admin-comment-actions-v25">
          <Link href={`/anime/${item.slug}?episode=${item.episode || 1}${item.voice ? `&voice=${encodeURIComponent(item.voice)}` : ''}#player`}>Открыть тайтл</Link>
          <button onClick={()=>update(item, item.status || 'open')}>Сохранить заметку</button>
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
