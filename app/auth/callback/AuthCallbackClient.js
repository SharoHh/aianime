'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createBrowserSupabase, fetchRuntimeSupabaseConfig, getBuildSupabaseConfig } from '@/lib/supabaseClient'
import { setImmediateAuthUser } from '@/components/AuthStateClient'

function safeNext(){
  if(typeof window === 'undefined') return '/profile'
  const next = new URLSearchParams(window.location.search).get('next') || '/profile'
  return next.startsWith('/') && !next.startsWith('//') ? next : '/profile'
}

function callbackError(){
  if(typeof window === 'undefined') return ''
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return query.get('error_description') || query.get('error') || hash.get('error_description') || hash.get('error') || ''
}

export default function AuthCallbackClient(){
  const [state,setState] = useState({ status:'loading', message:'Получаем сессию…' })

  useEffect(()=>{
    let alive = true
    let timer = null
    let subscription = null
    let completed = false

    async function finish(session){
      const user = session?.user || null
      if(!alive || completed || !user) return false
      completed = true
      setImmediateAuthUser(user)
      setState({ status:'success', message:'Вход выполнен. Открываем профиль…' })
      try{
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
      }catch{}
      setTimeout(() => window.location.replace(safeNext()), 120)
      return true
    }

    async function run(){
      const providerError = callbackError()
      if(providerError){
        setState({ status:'error', message:'Сервис авторизации отменил вход или вернул ошибку. Попробуй ещё раз.' })
        return
      }

      const buildConfig = getBuildSupabaseConfig()
      const runtimeConfig = await fetchRuntimeSupabaseConfig({ force:true }).catch(() => null)
      const supabase = createBrowserSupabase(runtimeConfig || buildConfig)
      if(!supabase){
        setState({ status:'error', message:'Supabase Auth не подключён.' })
        return
      }

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        finish(session)
      })
      subscription = authListener?.subscription || null

      const { data, error } = await supabase.auth.getSession()
      if(error){
        setState({ status:'error', message:'Не удалось проверить сессию авторизации.' })
        return
      }
      if(await finish(data?.session)) return

      // Browser client usually exchanges the PKCE code automatically during
      // initialization. Keep an explicit fallback for email confirmation and PKCE callbacks.
      const code = new URLSearchParams(window.location.search).get('code')
      if(code){
        const { data:exchangeData, error:exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if(!exchangeError && await finish(exchangeData?.session)) return
        if(exchangeError){
          setState({ status:'error', message:'Код подтверждения недействителен или уже использован. Повтори вход или запроси новое письмо.' })
          return
        }
      }

      timer = setTimeout(() => {
        if(alive) setState({ status:'error', message:'Сессия не получена. Повтори вход или открой новую ссылку подтверждения из письма.' })
      }, 10_000)
    }

    run().catch(() => {
      if(alive) setState({ status:'error', message:'Не удалось завершить вход.' })
    })

    return () => {
      alive = false
      if(timer) clearTimeout(timer)
      subscription?.unsubscribe?.()
    }
  }, [])

  return <section className={`auth-card auth-callback-card widget is-${state.status}`}>
    <div className="auth-callback-spinner" aria-hidden="true" />
    <h2>{state.status === 'error' ? 'Вход не завершён' : state.status === 'success' ? 'Готово' : 'Проверяем авторизацию'}</h2>
    <p>{state.message}</p>
    {state.status === 'error' ? <div className="auth-actions"><Link className="primary" href="/auth">Вернуться ко входу</Link><Link className="secondary" href="/">На главную</Link></div> : null}
  </section>
}
