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
      setNotes(Object.fromEntries(reports.map(item => [item.id, item.adminNote || ''])))
    }catch(err){
      setItems([])
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

  return <section className="admin-reports-panel-v172">
    <div className="admin-reports-toolbar-v172">
      <div>
        <b>Жалобы на плеер</b>
        <span>Быстро проверяй проблемные серии, озвучки и загрузку видео.</span>
      </div>
      <button type="button" onClick={load} disabled={loading}>{loading ? 'Обновляем…' : 'Обновить'}</button>
    </div>

    <div className="admin-report-status-grid-v168 admin-report-status-grid-v172">
      {filters.map(([value,label]) => <button key={value} type="button" className={status === value ? 'active' : ''} onClick={()=>setStatus(value)}>
        <span>{label}</span>
        <b>{computedSummary[value] ?? 0}</b>
      </button>)}
    </div>

    <label className="admin-reports-search-v172">
      <span>Поиск</span>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Тайтл, slug, озвучка, пользователь или текст жалобы" />
    </label>

    {error ? <div className="admin-warning-v25"><b>Жалобы не загрузились</b><span>{error}</span></div> : null}

    {loading ? <div className="empty-state">Загружаем жалобы…</div> : filteredItems.length ? <div className="admin-player-report-list-v172">
      {filteredItems.map(item => <article key={item.id} className="admin-report-card-v172">
        <div className="admin-report-main-v172">
          <header className="admin-report-head-v172">
            <div>
              <b>{item.reasonLabel || 'Проблема с плеером'}</b>
              <span className={`admin-comment-status-v26 ${item.status || 'open'}`}>{statusLabel(item.status)}</span>
            </div>
            <Link href={`/anime/${item.slug}?episode=${item.episode || 1}${item.voice ? `&voice=${encodeURIComponent(item.voice)}` : ''}#player`}>{item.title || item.slug}</Link>
          </header>

          <div className="admin-report-meta-v172">
            <span>Серия {item.episode || '—'}</span>
            {item.voice ? <span>{item.voice}</span> : null}
            <span>{formatDate(item.createdAt)}</span>
            <span>{item.userEmail || item.userName || item.clientId || 'гость'}</span>
          </div>

          {item.message ? <p className="admin-report-message-v172">{item.message}</p> : null}
          <code className="admin-report-slug-v172">{item.slug}</code>

          <label className="admin-report-note-v168 admin-report-note-v172">
            <span>Заметка админа</span>
            <textarea value={notes[item.id] ?? ''} onChange={e=>setNotes(prev => ({ ...prev, [item.id]:e.target.value }))} placeholder="Например: серия проверена, ждём Kodik, дубль жалобы..." />
          </label>
        </div>

        <footer className="admin-report-actions-v172">
          <Link href={`/anime/${item.slug}?episode=${item.episode || 1}${item.voice ? `&voice=${encodeURIComponent(item.voice)}` : ''}#player`}>Открыть тайтл</Link>
          <button type="button" onClick={()=>update(item, item.status || 'open')}>Сохранить</button>
          {item.status !== 'open' ? <button type="button" onClick={()=>update(item, 'open')}>Открыть</button> : null}
          {item.status !== 'checking' ? <button type="button" onClick={()=>update(item, 'checking')}>Проверяем</button> : null}
          {item.status !== 'fixed' ? <button type="button" onClick={()=>update(item, 'fixed')}>Исправлено</button> : null}
          {item.status !== 'ignored' ? <button type="button" onClick={()=>update(item, 'ignored')}>Отклонить</button> : null}
          <button type="button" className="danger" onClick={()=>remove(item)}>Удалить</button>
        </footer>
      </article>)}
    </div> : <div className="empty-state">Жалоб пока нет.</div>}
  </section>
}
