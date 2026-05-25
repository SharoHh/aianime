'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { pushToast } from '@/components/ToastCenter'
import { useAuthState } from '@/components/AuthStateClient'

function key(slug){ return `anime:comments:${slug}` }

function readLocal(slug){
  try{ return JSON.parse(localStorage.getItem(key(slug)) || '[]') }catch{ return [] }
}

function writeLocal(slug, list){
  localStorage.setItem(key(slug), JSON.stringify(list))
}

function normalizeLocal(item){
  return {
    id:item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    author:item.author || 'Пользователь Aianime',
    text:item.text || '',
    createdAt:item.createdAt || new Date().toISOString(),
    likes:Number(item.likes || 0),
    source:item.source || 'local'
  }
}

export default function CommentsClient({ slug, title }){
  const { loading:authLoading, configured, user, supabase } = useAuthState()
  const [items,setItems] = useState([])
  const [text,setText] = useState('')
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [source,setSource] = useState('local')

  const canUseCloud = configured && Boolean(supabase)
  const canComment = !canUseCloud || Boolean(user)

  useEffect(()=>{
    let active = true
    async function load(){
      setLoading(true)
      if(canUseCloud){
        try{
          const res = await fetch(`/api/comments?slug=${encodeURIComponent(slug)}`, { cache:'no-store' })
          const data = await res.json().catch(()=>null)
          if(active && res.ok && data?.ok){
            setItems(data.comments || [])
            setSource(data.source || 'supabase')
            setLoading(false)
            return
          }
        }catch{}
      }
      if(active){
        setItems(readLocal(slug).map(normalizeLocal))
        setSource('local')
        setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [slug, canUseCloud])

  const countLabel = useMemo(() => {
    if(loading) return '…'
    return String(items.length)
  }, [items.length, loading])

  async function submit(e){
    e.preventDefault()
    const clean = text.trim()
    if(!clean) return

    if(canUseCloud && !user){
      pushToast('Войди, чтобы оставить комментарий', 'info')
      return
    }

    setSaving(true)
    try{
      if(canUseCloud){
        const { data } = await supabase.auth.getSession()
        const token = data?.session?.access_token
        const res = await fetch('/api/comments', {
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            ...(token ? { Authorization:`Bearer ${token}` } : {})
          },
          body: JSON.stringify({ slug, text:clean })
        })
        const payload = await res.json().catch(()=>null)
        if(!res.ok || !payload?.ok) throw new Error(payload?.error || 'Не удалось сохранить комментарий')
        setItems(prev => [payload.comment, ...prev].slice(0,50))
        setText('')
        setSource('supabase')
        pushToast('Комментарий опубликован', 'success')
        return
      }

      const next = [{
        id: Date.now(),
        author: 'Пользователь Aianime',
        text: clean,
        createdAt: new Date().toISOString(),
        likes: 0,
        source:'local'
      }, ...items].slice(0,30)
      setItems(next)
      writeLocal(slug, next)
      setText('')
      pushToast('Комментарий добавлен', 'success')
    }catch(error){
      pushToast(error?.message || 'Комментарий не сохранён', 'error')
    }finally{
      setSaving(false)
    }
  }

  function like(id){
    // Лайки пока оставляем локальными: это не ломает основную модерацию и не требует отдельной таблицы.
    const next = items.map(item => item.id === id ? { ...item, likes: (item.likes || 0) + 1 } : item)
    setItems(next)
    if(source === 'local') writeLocal(slug, next)
  }

  return <section className="widget comments-box">
    <div className="widget-head"><h3>Комментарии</h3><span>{countLabel}</span></div>

    {authLoading ? <div className="comments-empty">Проверяем вход…</div> : canComment ? <form className="comment-form" onSubmit={submit}>
      <textarea
        value={text}
        onChange={e=>setText(e.target.value)}
        placeholder={`Поделись мнением о “${title}”...`}
        maxLength={1200}
      />
      <button className="primary" disabled={saving}>{saving ? 'Отправляем…' : 'Отправить'}</button>
    </form> : <div className="comments-login-box">
      <b>Войди, чтобы оставить комментарий</b>
      <span>Так комментарии будут привязаны к аккаунту и доступны для модерации.</span>
      <Link className="secondary" href="/auth">Войти</Link>
    </div>}

    <div className="comment-list">
      {loading ? <div className="comments-empty">Загружаем комментарии…</div> : items.length ? items.map(item => <article className="comment" key={item.id}>
        <div className="comment-avatar">{String(item.author || 'A').slice(0,1).toUpperCase()}</div>
        <div>
          <header><b>{item.author}</b><span>{new Date(item.createdAt).toLocaleDateString('ru-RU')}</span></header>
          <p>{item.text}</p>
          <button type="button" onClick={()=>like(item.id)}>♡ {item.likes || 0}</button>
        </div>
      </article>) : <div className="comments-empty">Комментариев пока нет. Будь первым.</div>}
    </div>
  </section>
}
