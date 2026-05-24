'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createBrowserSupabase, hasSupabaseBrowser } from '@/lib/supabaseClient'

export default function AuthClient(){
  const [mode,setMode] = useState('login')
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [message,setMessage] = useState('')
  const [user,setUser] = useState(null)
  const [loading,setLoading] = useState(false)
  const configured = hasSupabaseBrowser()
  const supabase = createBrowserSupabase()

  useEffect(()=>{
    if(!supabase) return
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
    return () => sub?.subscription?.unsubscribe?.()
  }, [])

  async function submit(e){
    e.preventDefault()
    setMessage('')
    if(!configured || !supabase){
      setMessage('Supabase не настроен. Добавь NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local')
      return
    }
    setLoading(true)
    try{
      const payload = { email, password }
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword(payload)
        : await supabase.auth.signUp(payload)

      if(result.error) setMessage(result.error.message)
      else setMessage(mode === 'login' ? 'Вход выполнен.' : 'Регистрация создана. Если включено подтверждение email — проверь почту.')
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
    return <section className="auth-card widget">
      <div className="auth-user">
        <div><span>аккаунт</span><h2>{user.email}</h2><p>Теперь можно синхронизировать избранное, историю, оценки и AI-запросы с Supabase.</p></div>
      </div>
      <div className="auth-actions">
        <Link className="primary" href="/profile">Открыть профиль</Link>
        <button className="secondary" onClick={logout}>Выйти</button>
      </div>
    </section>
  }

  return <section className="auth-card widget">
    <div className="auth-tabs">
      <button className={mode === 'login' ? 'active' : ''} onClick={()=>setMode('login')}>Вход</button>
      <button className={mode === 'signup' ? 'active' : ''} onClick={()=>setMode('signup')}>Регистрация</button>
    </div>

    <form onSubmit={submit} className="auth-form">
      <label><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" required /></label>
      <label><span>Пароль</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Минимум 6 символов" required /></label>
      <button className="primary" disabled={loading}>{loading ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
    </form>

    {message ? <div className="auth-message">{message}</div> : null}
    {!configured ? <div className="auth-warning">Supabase env пока не настроен. Авторизация включится после добавления ключей.</div> : null}
  </section>
}
