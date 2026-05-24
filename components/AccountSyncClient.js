'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuthState } from '@/components/AuthStateClient'
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

function readLocalCounts(){
  return {
    favorites:getFavorites().length,
    history:getHistory().length,
    ratings:Object.entries(getRatings()).filter(([,v]) => Number(v)).length,
    ai:readJson('ai_query_history', []).length
  }
}

export default function AccountSyncClient(){
  const { configured, user, supabase } = useAuthState()
  const [status,setStatus] = useState('idle')
  const [message,setMessage] = useState('')
  const [counts,setCounts] = useState({ favorites:0, history:0, ratings:0, ai:0 })

  useEffect(()=>{
    const updateCounts = () => setCounts(readLocalCounts())
    updateCounts()
    window.addEventListener('storage', updateCounts)
    window.addEventListener('anime:user-updated', updateCounts)
    return () => {
      window.removeEventListener('storage', updateCounts)
      window.removeEventListener('anime:user-updated', updateCounts)
    }
  }, [])


  async function sync(){
    if(!supabase || !user){
      setMessage('Сначала войди в аккаунт.')
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

      setCounts({ favorites:favorites.length, history:history.length, ratings:ratings.length, ai:ai.length })
      setStatus('done')
      setMessage(`Сохранено: избранное ${favorites.length}, история ${history.length}, оценки ${ratings.length}, AI ${ai.length}.`)
    }catch(error){
      setStatus('error')
      setMessage(error?.message || 'Не удалось сохранить данные аккаунта.')
    }
  }

  if(!configured){
    return <section className="widget account-sync profile-sync-card-v7">
      <div>
        <span>аккаунт</span>
        <b>Авторизация не подключена</b>
        <p>Добавь переменные окружения авторизации, чтобы включить вход и сохранение данных аккаунта.</p>
      </div>
      <Link className="secondary" href="/auth">Войти</Link>
    </section>
  }

  if(!user){
    return <section className="widget account-sync profile-sync-card-v7">
      <div>
        <span>аккаунт</span>
        <b>Войди в аккаунт</b>
        <p>После входа можно сохранить избранное, историю и оценки в личном профиле.</p>
      </div>
      <Link className="primary" href="/auth">Войти</Link>
    </section>
  }

  return <section className="widget account-sync profile-sync-card-v7">
    <div className="profile-sync-content-v7">
      <span>данные аккаунта</span>
      <b>Сохранить прогресс</b>
      <p>Избранное, история просмотра, оценки и AI-запросы будут привязаны к аккаунту и останутся доступны после входа на другом устройстве.</p>
      <div className="profile-sync-stats-v7">
        <i>{counts.favorites} избранное</i>
        <i>{counts.history} история</i>
        <i>{counts.ratings} оценки</i>
        <i>{counts.ai} AI</i>
      </div>
      {message ? <em className={status === 'error' ? 'is-error' : ''}>{message}</em> : null}
    </div>
    <button className={status === 'done' ? 'secondary' : 'primary'} onClick={sync} disabled={status === 'loading'}>{status === 'loading' ? 'Сохраняю…' : 'Сохранить данные'}</button>
  </section>
}
