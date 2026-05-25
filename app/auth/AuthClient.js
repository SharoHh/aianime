'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createBrowserSupabase, hasSupabaseBrowser } from '@/lib/supabaseClient'
import { getUserDisplayName, setImmediateAuthUser } from '@/components/AuthStateClient'

function authErrorMessage(message){
  const text = String(message || '')
  if(text.toLowerCase().includes('invalid login')) return 'Неверный email или пароль.'
  if(text.toLowerCase().includes('email not confirmed')) return 'Email ещё не подтверждён. Проверь почту.'
  if(text.toLowerCase().includes('password')) return 'Проверь пароль: минимум 6 символов.'
  return text || 'Ошибка авторизации.'
}

function getNextUrl(){
  if(typeof window === 'undefined') return '/profile'
  const params = new URLSearchParams(window.location.search)
  const next = params.get('next') || '/profile'
  return next.startsWith('/') ? next : '/profile'
}

export default function AuthClient(){
  const [mode,setMode] = useState('login')
  const [name,setName] = useState('')
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [message,setMessage] = useState('')
  const [user,setUser] = useState(null)
  const [loading,setLoading] = useState(false)
  const configured = hasSupabaseBrowser()
  const supabase = useMemo(() => createBrowserSupabase(), [])

  useEffect(()=>{
    if(!supabase){
      setUser(null)
      return undefined
    }

    let alive = true
    supabase.auth.getUser().then(({ data }) => {
      if(alive) setUser(data?.user || null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if(alive) setUser(session?.user || null)
    })
    return () => {
      alive = false
      sub?.subscription?.unsubscribe?.()
    }
  }, [supabase])

  async function submit(e){
    e.preventDefault()
    setMessage('')
    if(!configured || !supabase){
      setMessage('Supabase не настроен. Добавь NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY и NEXT_PUBLIC_ENABLE_SUPABASE_RUNTIME=1')
      return
    }

    setLoading(true)
    try{
      const cleanEmail = email.trim()
      const cleanName = name.trim()
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email:cleanEmail, password })
        : await supabase.auth.signUp({
            email:cleanEmail,
            password,
            options:{ data:{ name:cleanName || cleanEmail.split('@')[0] } }
          })

      if(result.error){
        setMessage(authErrorMessage(result.error.message))
        return
      }

      const nextUser = result.data?.user || null
      const hasSession = Boolean(result.data?.session)
      setUser(nextUser)
      if(nextUser) setImmediateAuthUser(nextUser)

      if(mode === 'login' || hasSession){
        window.location.replace(getNextUrl())
        return
      }

      setMessage('Аккаунт создан. Если включено подтверждение email — проверь почту и затем войди.')
    }finally{
      setLoading(false)
    }
  }

  async function logout(){
    if(!supabase) return
    await supabase.auth.signOut()
    setUser(null)
  }

  if(user){
    return <section className="auth-card auth-card-signed widget">
      <div className="auth-user">
        <span>аккаунт</span>
        <h2>{getUserDisplayName(user)}</h2>
        <p>{user.email}</p>
      </div>
      <div className="auth-actions">
        <Link className="primary" href="/profile">Открыть профиль</Link>
        <button className="secondary" onClick={logout}>Выйти</button>
      </div>
    </section>
  }

  return <section className="auth-card auth-card-premium widget">
    <div className="auth-profile-preview" aria-hidden="true">
      <img src="/posters/oshi.svg" alt=""/>
      <div>
        <span>Aianime ID</span>
        <b>{mode === 'signup' ? (name || 'Твой профиль') : 'Вход в аккаунт'}</b>
      </div>
    </div>

    <div className="auth-tabs">
      <button type="button" className={mode === 'login' ? 'active' : ''} onClick={()=>setMode('login')}>Вход</button>
      <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={()=>setMode('signup')}>Регистрация</button>
    </div>

    <form onSubmit={submit} className="auth-form">
      {mode === 'signup' ? <label><span>Имя профиля</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Например, Haruno" /></label> : null}
      <label><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" required /></label>
      <label><span>Пароль</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Минимум 6 символов" minLength={6} required /></label>
      <button className="primary" disabled={loading}>{loading ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
    </form>

    {message ? <div className="auth-message">{message}</div> : null}
    {!configured ? <div className="auth-warning">Supabase Auth пока не включён в runtime. Проверь env на VPS и перезапусти PM2.</div> : null}
  </section>
}
