'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createBrowserSupabase, hasSupabaseBrowser } from '@/lib/supabaseClient'
import { getFavorites, getHistory, getRatings, readJson } from '@/lib/userStorage'

function normalizeFavorite(userId, item){
  return {
    user_id: userId,
    anime_slug: item.slug,
    title: item.title || null,
    poster: item.poster || null,
    rating: item.rating || null,
    meta: item.meta || null,
    saved_at: item.savedAt || new Date().toISOString()
  }
}

function normalizeHistory(userId, item){
  return {
    user_id: userId,
    anime_slug: item.slug,
    title: item.title || null,
    poster: item.poster || null,
    banner: item.banner || null,
    episode: Number(item.episode || 1),
    progress: Number(item.progress || 0),
    watched_at: item.watchedAt || new Date().toISOString()
  }
}

function normalizeRating(userId, slug, value){
  return {
    user_id: userId,
    anime_slug: slug,
    rating: Number(value),
    updated_at: new Date().toISOString()
  }
}

function normalizeAi(userId, query){
  return {
    user_id: userId,
    query,
    created_at: new Date().toISOString()
  }
}

export default function AccountSyncClient(){
  const [user,setUser] = useState(null)
  const [status,setStatus] = useState('idle')
  const [message,setMessage] = useState('')
  const configured = hasSupabaseBrowser()
  const supabase = createBrowserSupabase()

  useEffect(()=>{
    if(!supabase) return
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null))
    return () => sub?.subscription?.unsubscribe?.()
  }, [])

  async function sync(){
    if(!supabase || !user){
      setMessage('Нужно войти в аккаунт.')
      return
    }
    setStatus('loading')
    setMessage('')
    try{
      const favorites = getFavorites().map(item => normalizeFavorite(user.id, item))
      const history = getHistory().map(item => normalizeHistory(user.id, item))
      const ratings = Object.entries(getRatings()).filter(([,v]) => Number(v)).map(([slug,value]) => normalizeRating(user.id, slug, value))
      const ai = readJson('ai_query_history', []).map(query => normalizeAi(user.id, query))

      if(favorites.length){
        const { error } = await supabase.from('user_favorites').upsert(favorites, { onConflict: 'user_id,anime_slug' })
        if(error) throw error
      }
      if(history.length){
        const { error } = await supabase.from('user_history').upsert(history, { onConflict: 'user_id,anime_slug' })
        if(error) throw error
      }
      if(ratings.length){
        const { error } = await supabase.from('user_ratings').upsert(ratings, { onConflict: 'user_id,anime_slug' })
        if(error) throw error
      }
      if(ai.length){
        const { error } = await supabase.from('user_ai_history').insert(ai)
        if(error) throw error
      }

      setStatus('done')
      setMessage(`Синхронизировано: избранное ${favorites.length}, история ${history.length}, оценки ${ratings.length}, AI ${ai.length}.`)
    }catch(error){
      setStatus('error')
      setMessage(error?.message || 'Ошибка синхронизации.')
    }
  }

  if(!configured){
    return <section className="widget account-sync">
      <div><b>Аккаунт не подключён</b><p>Добавь Supabase env, чтобы включить вход и синхронизацию.</p></div>
      <Link className="secondary" href="/auth">Настроить вход</Link>
    </section>
  }

  if(!user){
    return <section className="widget account-sync">
      <div><b>Войди в аккаунт</b><p>После входа профиль, история, избранное и оценки будут доступны для синхронизации.</p></div>
      <Link className="primary" href="/auth">Войти</Link>
    </section>
  }

  return <section className="widget account-sync">
    <div><b>{user.email}</b><p>Синхронизируй локальные данные с Supabase, чтобы не потерять их.</p>{message ? <span>{message}</span> : null}</div>
    <button className={status === 'done' ? 'secondary' : 'primary'} onClick={sync} disabled={status === 'loading'}>{status === 'loading' ? 'Синхронизация…' : 'Синхронизировать'}</button>
  </section>
}
