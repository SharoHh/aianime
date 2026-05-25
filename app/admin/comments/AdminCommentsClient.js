'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { pushToast } from '@/components/ToastCenter'

function statusLabel(status){
  if(status === 'hidden') return 'Скрыт'
  if(status === 'deleted') return 'Удалён'
  return 'Опубликован'
}

function legacyLocalComments(){
  const result = []
  if(typeof window === 'undefined') return result
  for(let i=0;i<localStorage.length;i++){
    const key = localStorage.key(i)
    if(!key?.startsWith('anime:comments:')) continue
    try{
      const slug = key.replace('anime:comments:', '')
      const items = JSON.parse(localStorage.getItem(key) || '[]')
      items.forEach(item => result.push({
        ...item,
        slug,
        storageKey:key,
        status:'local',
        createdAt:item.createdAt || new Date().toISOString(),
        source:'local'
      }))
    }catch{}
  }
  return result.sort((a,b)=>Number(new Date(b.createdAt))-Number(new Date(a.createdAt)))
}

export default function AdminCommentsClient(){
  const [items,setItems] = useState([])
  const [localItems,setLocalItems] = useState([])
  const [status,setStatus] = useState('all')
  const [query,setQuery] = useState('')
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')

  async function load(){
    setLoading(true)
    setError('')
    try{
      const res = await fetch(`/api/admin/comments?status=${encodeURIComponent(status)}`, { cache:'no-store' })
      const data = await res.json().catch(()=>null)
      if(!res.ok || !data?.ok) throw new Error(data?.error || 'Не удалось загрузить комментарии')
      setItems(data.comments || [])
    }catch(err){
      setItems([])
      setError(err?.message || 'Не удалось загрузить комментарии из Supabase')
    }finally{
      setLocalItems(legacyLocalComments())
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [status])

  const filteredItems = useMemo(() => {
    const clean = query.trim().toLowerCase()
    if(!clean) return items
    return items.filter(item => [item.slug, item.author, item.text].some(value => String(value || '').toLowerCase().includes(clean)))
  }, [items, query])

  async function updateStatus(item, nextStatus){
    try{
      const res = await fetch('/api/admin/comments', {
        method:'PATCH',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ id:item.id, status:nextStatus })
      })
      const data = await res.json().catch(()=>null)
      if(!res.ok || !data?.ok) throw new Error(data?.error || 'Не удалось обновить комментарий')
      setItems(prev => prev.map(current => current.id === item.id ? { ...current, status:nextStatus } : current))
      pushToast(nextStatus === 'published' ? 'Комментарий опубликован' : 'Комментарий скрыт', 'success')
    }catch(error){
      pushToast(error?.message || 'Не удалось обновить комментарий', 'error')
    }
  }

  async function removeCloud(item){
    if(!window.confirm('Удалить комментарий без возможности восстановления?')) return
    try{
      const res = await fetch(`/api/admin/comments?id=${encodeURIComponent(item.id)}`, { method:'DELETE' })
      const data = await res.json().catch(()=>null)
      if(!res.ok || !data?.ok) throw new Error(data?.error || 'Не удалось удалить комментарий')
      setItems(prev => prev.filter(current => current.id !== item.id))
      pushToast('Комментарий удалён', 'success')
    }catch(error){
      pushToast(error?.message || 'Не удалось удалить комментарий', 'error')
    }
  }

  function removeLocal(comment){
    const list = JSON.parse(localStorage.getItem(comment.storageKey) || '[]').filter(x=>x.id!==comment.id)
    localStorage.setItem(comment.storageKey, JSON.stringify(list))
    setLocalItems(legacyLocalComments())
    pushToast('Локальный комментарий удалён', 'success')
  }

  return <section className="widget admin-edit-preview admin-comments-panel-v25">
    <div className="admin-comments-toolbar-v25">
      <div>
        <b>Модерация комментариев</b>
        <span>Публично показываются только опубликованные комментарии из Supabase.</span>
      </div>
      <button className="secondary" onClick={load} disabled={loading}>{loading ? 'Обновляем…' : 'Обновить'}</button>
    </div>

    <div className="admin-comments-filters-v25">
      {[
        ['all', 'Все'],
        ['published', 'Опубликованные'],
        ['hidden', 'Скрытые'],
        ['deleted', 'Удалённые']
      ].map(([value,label]) => <button key={value} className={status === value ? 'active' : ''} onClick={()=>setStatus(value)}>{label}</button>)}
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по slug, автору или тексту" />
    </div>

    {error ? <div className="admin-warning-v25"><b>Supabase-комментарии не загрузились</b><span>{error}</span></div> : null}

    {loading ? <div className="empty-state">Загружаем комментарии…</div> : filteredItems.length ? <div className="admin-simple-list comment-admin-list comment-admin-list-v25">
      {filteredItems.map(item=><article key={item.id}>
        <div>
          <b>{item.author} · <Link href={`/anime/${item.slug}`}>{item.slug}</Link></b>
          <span>{item.text}</span>
          <em>{statusLabel(item.status)} · {new Date(item.createdAt).toLocaleString('ru-RU')}</em>
        </div>
        <div className="admin-comment-actions-v25">
          {item.status !== 'published' ? <button onClick={()=>updateStatus(item, 'published')}>Опубликовать</button> : null}
          {item.status !== 'hidden' ? <button onClick={()=>updateStatus(item, 'hidden')}>Скрыть</button> : null}
          <button onClick={()=>removeCloud(item)}>Удалить</button>
        </div>
      </article>)}
    </div> : <div className="empty-state">Комментариев в Supabase пока нет.</div>}

    {localItems.length ? <div className="admin-local-comments-v25">
      <h3>Локальные комментарии на этом устройстве</h3>
      <p>Это старые комментарии из localStorage. Они видны только в этом браузере и не модерируются через Supabase.</p>
      <div className="admin-simple-list comment-admin-list comment-admin-list-v25">
        {localItems.slice(0,30).map(item=><article key={`${item.storageKey}-${item.id}`}>
          <div><b>{item.author} · {item.slug}</b><span>{item.text}</span></div>
          <div className="admin-comment-actions-v25"><button onClick={()=>removeLocal(item)}>Удалить локально</button></div>
        </article>)}
      </div>
    </div> : null}
  </section>
}
