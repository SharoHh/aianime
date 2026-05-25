'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { pushToast } from '@/components/ToastCenter'
import { useAuthState } from '@/components/AuthStateClient'

function key(slug){ return `anime:comments:${slug}` }
function likedKey(slug){ return `anime:comment-likes:${slug}` }
const CLIENT_ID_KEY = 'anime:comment-client-id'

function readJson(name, fallback){
  try{ return JSON.parse(localStorage.getItem(name) || '') }catch{ return fallback }
}

function writeJson(name, value){
  try{ localStorage.setItem(name, JSON.stringify(value)) }catch{}
}

function getClientId(){
  if(typeof window === 'undefined') return ''
  try{
    let id = localStorage.getItem(CLIENT_ID_KEY)
    if(!id){
      const suffix = Math.random().toString(36).slice(2)
      id = `browser-${Date.now().toString(36)}-${suffix}`
      localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  }catch{
    return `ephemeral-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }
}

function readLocal(slug){ return readJson(key(slug), []) }
function writeLocal(slug, list){ writeJson(key(slug), list) }
function readLiked(slug){ return new Set(readJson(likedKey(slug), [])) }
function writeLiked(slug, set){ writeJson(likedKey(slug), Array.from(set)) }

function normalizeLocal(item, likedSet = new Set()){
  const id = String(item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`)
  return {
    id,
    author:item.author || 'Пользователь Aianime',
    text:item.text || '',
    createdAt:item.createdAt || new Date().toISOString(),
    likes:Number(item.likes || 0),
    liked:Boolean(item.liked || likedSet.has(id)),
    source:item.source || 'local'
  }
}

function normalizeCloud(item, likedSet = new Set()){
  const id = String(item.id)
  return {
    ...item,
    id,
    likes:Number(item.likes || 0),
    liked:Boolean(item.liked || likedSet.has(id)),
    source:item.source || 'supabase'
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
      const likedSet = readLiked(slug)
      if(canUseCloud){
        try{
          const res = await fetch(`/api/comments?slug=${encodeURIComponent(slug)}`, { cache:'no-store' })
          const data = await res.json().catch(()=>null)
          if(active && res.ok && data?.ok){
            setItems((data.comments || []).map(item => normalizeCloud(item, likedSet)))
            setSource(data.source || 'supabase')
            setLoading(false)
            return
          }
        }catch{}
      }
      if(active){
        setItems(readLocal(slug).map(item => normalizeLocal(item, likedSet)))
        setSource('local')
        setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [slug, canUseCloud])

  const countLabel = useMemo(() => loading ? '…' : String(items.length), [items.length, loading])

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
        setItems(prev => [normalizeCloud(payload.comment), ...prev].slice(0,50))
        setText('')
        setSource('supabase')
        pushToast('Комментарий опубликован', 'success')
        return
      }

      const next = [normalizeLocal({
        id: String(Date.now()),
        author: 'Пользователь Aianime',
        text: clean,
        createdAt: new Date().toISOString(),
        likes: 0,
        liked:false,
        source:'local'
      }), ...items].slice(0,30)
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

  async function like(id){
    const cleanId = String(id)
    const current = items.find(item => String(item.id) === cleanId)
    if(!current) return
    if(current.liked){
      pushToast('Ты уже поставил сердечко', 'info')
      return
    }

    const likedSet = readLiked(slug)
    if(likedSet.has(cleanId)){
      setItems(prev => prev.map(item => String(item.id) === cleanId ? { ...item, liked:true } : item))
      pushToast('Ты уже поставил сердечко', 'info')
      return
    }

    if(source !== 'supabase'){
      likedSet.add(cleanId)
      const next = items.map(item => String(item.id) === cleanId ? { ...item, likes:(item.likes || 0) + 1, liked:true } : item)
      setItems(next)
      writeLocal(slug, next)
      writeLiked(slug, likedSet)
      return
    }

    likedSet.add(cleanId)
    writeLiked(slug, likedSet)
    setItems(prev => prev.map(item => String(item.id) === cleanId ? {
      ...item,
      likes:Number(item.likes || 0) + 1,
      liked:true
    } : item))

    try{
      const clientId = getClientId()
      let token = ''
      if(canUseCloud && supabase){
        try{
          const { data } = await supabase.auth.getSession()
          token = data?.session?.access_token || ''
        }catch{}
      }
      const res = await fetch('/api/comments', {
        method:'PATCH',
        headers:{
          'Content-Type':'application/json',
          ...(token ? { Authorization:`Bearer ${token}` } : {})
        },
        body: JSON.stringify({ id:cleanId, action:'like', clientId })
      })
      const data = await res.json().catch(()=>null)
      if(!res.ok || !data?.ok) throw new Error(data?.error || 'Не удалось сохранить сердечко')
      setItems(prev => prev.map(item => String(item.id) === cleanId ? {
        ...item,
        likes:Number(data.likes ?? item.likes ?? 0),
        liked:true
      } : item))
      if(data.duplicate) pushToast('Ты уже ставил сердечко', 'info')
    }catch(error){
      likedSet.delete(cleanId)
      writeLiked(slug, likedSet)
      setItems(prev => prev.map(item => String(item.id) === cleanId ? {
        ...item,
        likes:Math.max(0, Number(item.likes || 0) - 1),
        liked:false
      } : item))
      pushToast(error?.message || 'Сердечко не сохранилось', 'error')
    }
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
          <button
            type="button"
            className={item.liked ? 'liked' : ''}
            aria-pressed={Boolean(item.liked)}
            onClick={()=>like(item.id)}
          >{item.liked ? '♥' : '♡'} {item.likes || 0}</button>
        </div>
      </article>) : <div className="comments-empty">Комментариев пока нет. Будь первым.</div>}
    </div>
  </section>
}
