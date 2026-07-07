'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createBrowserSupabase, fetchRuntimeSupabaseConfig, getBuildSupabaseConfig, hasSupabaseBrowser } from '@/lib/supabaseClient'
import { getUserDisplayName, setImmediateAuthUser, setPendingAuthSession } from '@/components/AuthStateClient'
import { resetLocalAccountState } from '@/lib/userStorage'

function authErrorMessage(message){
  const text = String(message || '')
  if(text.toLowerCase().includes('invalid login')) return 'Неверный email или пароль.'
  if(text.toLowerCase().includes('email not confirmed')) return 'Email ещё не подтверждён. Проверь почту.'
  if(text.toLowerCase().includes('password')) return 'Проверь пароль: минимум 8 символов.'
  return text || 'Ошибка авторизации.'
}

function getNextUrl(){
  if(typeof window === 'undefined') return '/profile'
  const params = new URLSearchParams(window.location.search)
  const next = params.get('next') || '/profile'
  return next.startsWith('/') && !next.startsWith('//') ? next : '/profile'
}

async function loadRuntimeSupabaseConfig(){
  return await fetchRuntimeSupabaseConfig({ force:true }).catch(() => null)
}

export default function AuthClient(){
  const [mode,setMode] = useState('login')
  const [name,setName] = useState('')
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [message,setMessage] = useState('')
  const [user,setUser] = useState(null)
  const [loading,setLoading] = useState(false)
  const [runtimeConfig,setRuntimeConfig] = useState(() => getBuildSupabaseConfig())
  const [configChecked,setConfigChecked] = useState(hasSupabaseBrowser(getBuildSupabaseConfig()))

  const configured = hasSupabaseBrowser(runtimeConfig)
  const supabase = useMemo(() => createBrowserSupabase(runtimeConfig), [runtimeConfig])

  useEffect(()=>{
    let alive = true

    // Runtime endpoint сохраняет авторизацию рабочей на VPS, даже когда публичные
    // параметры Supabase не были встроены в клиентский bundle во время build.
    loadRuntimeSupabaseConfig()
      .then(config => {
        if(!alive) return
        if(config) setRuntimeConfig(config)
        setConfigChecked(true)
      })
      .catch(() => {
        if(alive) setConfigChecked(true)
      })

    return () => { alive = false }
  }, [])

  useEffect(()=>{
    if(!supabase){
      setUser(null)
      return undefined
    }

    let alive = true
    supabase.auth.getUser().then(({ data }) => {
      if(alive) setUser(data?.user || null)
    }).catch(() => {})
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if(alive) setUser(session?.user || null)
    })
    return () => {
      alive = false
      sub?.subscription?.unsubscribe?.()
    }
  }, [supabase])

  async function ensureSupabase(){
    if(supabase) return supabase
    const config = await loadRuntimeSupabaseConfig().catch(() => null)
    if(config){
      setRuntimeConfig(config)
      return createBrowserSupabase(config)
    }
    return null
  }

  async function signInWithServerProxy(cleanEmail, activeSupabase){
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    try{
      const response = await fetch('/api/auth/password-login', {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({ email:cleanEmail, password }),
        signal:controller.signal,
        cache:'no-store'
      })
      const data = await response.json().catch(() => ({}))
      if(!response.ok || !data?.ok){
        const error = new Error(data?.error || 'Ошибка авторизации.')
        error.status = response.status
        throw error
      }

      const session = data.session
      const nextUser = data.user || session?.user || null

      if(session?.access_token && session?.refresh_token){
        // Запоминаем сессию сразу, до сетевого setSession. Так /profile не успевает
        // открыться гостевым экраном, если Supabase Auth отвечает медленно.
        setPendingAuthSession(session, nextUser)
        activeSupabase.auth.setSession({
          access_token:session.access_token,
          refresh_token:session.refresh_token
        }).catch(() => {})
      }

      return { data:{ user:nextUser, session }, error:null, via:'server-proxy' }
    }finally{
      clearTimeout(timer)
    }
  }


  async function submit(e){
    e.preventDefault()
    setMessage('')
    setLoading(true)

    try{
      const activeSupabase = await ensureSupabase()
      if(!activeSupabase){
        setMessage('Вход временно недоступен: Supabase не подключён на сервере.')
        return
      }

      const cleanEmail = email.trim()
      const cleanName = name.trim()
      let result
      if(mode === 'login'){
        // Основной вход идёт через серверный same-origin proxy. Для пользователя это
        // обычно быстрее и стабильнее, чем прямой запрос браузера к Supabase Auth.
        try{
          result = await signInWithServerProxy(cleanEmail, activeSupabase)
        }catch(proxyError){
          // Прямой fallback разрешён только при технической ошибке endpoint. Ошибки
          // пароля и rate limit нельзя обходить вторым запросом напрямую в Supabase.
          const status = Number(proxyError?.status || 0)
          if(status && status < 500 && status !== 404){
            result = { data:{ user:null, session:null }, error:proxyError }
          }else{
            result = await activeSupabase.auth.signInWithPassword({ email:cleanEmail, password })
            if(result.error && proxyError?.message) result.error.message = proxyError.message
          }
        }
      }else{
        const emailCallback = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(getNextUrl())}` : undefined
        result = await activeSupabase.auth.signUp({
          email:cleanEmail,
          password,
          options:{
            data:{ name:cleanName || cleanEmail.split('@')[0] },
            emailRedirectTo:emailCallback
          }
        })
      }

      if(result.error){
        setMessage(authErrorMessage(result.error.message))
        return
      }

      const nextUser = result.data?.user || result.data?.session?.user || null
      const hasSession = Boolean(result.data?.session)
      if(result.data?.session) setPendingAuthSession(result.data.session, nextUser)
      setUser(nextUser)
      if(nextUser) setImmediateAuthUser(nextUser)

      if(mode === 'login' || hasSession){
        setMessage('Готово, открываем профиль…')
        setLoading(false)
        setTimeout(() => window.location.replace(getNextUrl()), 80)
        return
      }

      setMessage('Аккаунт создан. Если включено подтверждение email — проверь почту и затем войди.')
    }finally{
      setLoading(false)
    }
  }

  async function logout(){
    setUser(null)
    resetLocalAccountState()
    if(!supabase) return
    supabase.auth.signOut({ scope:'local' }).catch(() => {})
  }

  if(user){
    return <section className="auth-card auth-card-signed widget">
      <div className="auth-user">
        <span>аккаунт</span>
        <h2>{getUserDisplayName(user)}</h2>
        <p>{user.email || 'Email не указан'}</p>
      </div>
      <div className="auth-actions">
        <Link className="primary" href="/profile">Открыть профиль</Link>
        <button className="secondary" onClick={logout}>Выйти</button>
      </div>
    </section>
  }

  return <section className="auth-card auth-card-premium widget" data-aianime-auth-ui="v64">
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
      {mode === 'signup' ? <label><span>Имя профиля</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Например, Haruno" autoComplete="name" maxLength={80} /></label> : null}
      <label><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" maxLength={254} required /></label>
      <label><span>Пароль</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Минимум 8 символов' : 'Твой пароль'} minLength={mode === 'signup' ? 8 : 1} maxLength={1024} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required /></label>
      <button className="primary" disabled={loading}>{loading ? (mode === 'login' ? 'Входим…' : 'Создаём…') : mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
    </form>

    {message ? <div className="auth-message">{message}</div> : null}
    {!configured && !configChecked ? <div className="auth-message">Подключаем вход…</div> : null}
    {!configured && configChecked ? <div className="auth-warning">Вход временно недоступен: Supabase не подключён на сервере.</div> : null}
  </section>
}
