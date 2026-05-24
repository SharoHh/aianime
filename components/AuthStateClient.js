'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserSupabase, hasSupabaseBrowser } from '@/lib/supabaseClient'

export const baseProfileDefaults = {
  name: 'Профиль Aianime',
  level: 'Новый участник',
  avatar: '/posters/oshi.svg',
  cover: '/images/profile-sidebar-bg.png'
}

const AUTH_USER_CACHE_KEY = 'anime:auth-user-cache'

export function getUserDisplayName(user){
  const metadata = user?.user_metadata || {}
  const raw = metadata.name || metadata.full_name || metadata.display_name || user?.email?.split('@')?.[0] || 'Профиль Aianime'
  return String(raw).trim() || 'Профиль Aianime'
}

export function getProfileDefaults(user){
  return {
    ...baseProfileDefaults,
    name: getUserDisplayName(user),
    level: user?.email ? 'Аккаунт подключён' : baseProfileDefaults.level,
    avatar: user?.user_metadata?.avatar_url || baseProfileDefaults.avatar,
    cover: baseProfileDefaults.cover
  }
}

export function profileStorageKey(user){
  return user?.id ? `anime:profile:${user.id}` : 'anime:profile'
}

export function readStoredProfile(user){
  if(typeof window === 'undefined') return getProfileDefaults(user)
  const defaults = getProfileDefaults(user)
  try{
    const scoped = localStorage.getItem(profileStorageKey(user))
    if(scoped) return { ...defaults, ...JSON.parse(scoped) }

    const legacy = localStorage.getItem('anime:profile')
    if(legacy) return { ...defaults, ...JSON.parse(legacy) }
  }catch{}
  return defaults
}

export function saveStoredProfile(user, profile){
  if(typeof window === 'undefined') return
  const next = { ...getProfileDefaults(user), ...(profile || {}) }
  localStorage.setItem(profileStorageKey(user), JSON.stringify(next))
  window.dispatchEvent(new Event('anime:user-updated'))
}

function readCachedUser(){
  if(typeof window === 'undefined') return null
  try{
    const raw = localStorage.getItem(AUTH_USER_CACHE_KEY)
    if(!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.id ? parsed : null
  }catch{
    return null
  }
}

function writeCachedUser(user){
  if(typeof window === 'undefined') return
  try{
    if(user?.id){
      localStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify(user))
    }else{
      localStorage.removeItem(AUTH_USER_CACHE_KEY)
    }
  }catch{}
}

function withTimeout(promise, ms, fallback){
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms))
  ])
}

let cachedAuthState = null
let authBootstrapPromise = null
let authSubscription = null
const authListeners = new Set()

function emitAuthState(next){
  cachedAuthState = next
  if(next?.user || next?.loading === false) writeCachedUser(next?.user || null)
  authListeners.forEach(listener => listener(next))
}

function normalizeUserFromSession(session){
  return session?.user || null
}

function subscribeAuthState(listener){
  authListeners.add(listener)
  if(cachedAuthState) listener(cachedAuthState)
  return () => authListeners.delete(listener)
}

function bootstrapAuth(supabase, configured){
  if(!configured || !supabase){
    const next = { loading:false, configured:false, user:null }
    emitAuthState(next)
    return Promise.resolve(next)
  }

  if(authBootstrapPromise) return authBootstrapPromise

  authBootstrapPromise = (async () => {
    const cachedUser = readCachedUser()

    // Быстрый промежуточный стейт: если пользователь уже был известен, профиль
    // и сайдбар не исчезают на переходах, пока Supabase проверяет сессию.
    if(cachedUser){
      emitAuthState({ loading:false, configured:true, user:cachedUser })
    }

    try{
      const sessionResult = await withTimeout(
        supabase.auth.getSession(),
        900,
        { data:{ session:null }, error:null, timedOut:true }
      )

      const sessionUser = normalizeUserFromSession(sessionResult?.data?.session) || cachedUser || null
      const sessionState = { loading:false, configured:true, user:sessionUser }
      emitAuthState(sessionState)

      // getUser полезен для свежей проверки, но он не должен держать страницу
      // профиля в бесконечном пустом skeleton, если сеть/Supabase отвечает долго.
      withTimeout(
        supabase.auth.getUser(),
        1200,
        { data:{ user:sessionUser }, error:null, timedOut:true }
      ).then(({ data }) => {
        const freshUser = data?.user || sessionUser || null
        emitAuthState({ loading:false, configured:true, user:freshUser })
      }).catch(() => {
        emitAuthState(sessionState)
      })

      if(!authSubscription){
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          const nextUser = event === 'SIGNED_OUT' ? null : normalizeUserFromSession(session)
          emitAuthState({ loading:false, configured:true, user:nextUser })
          if(typeof window !== 'undefined') window.dispatchEvent(new Event('anime:user-updated'))
        })
        authSubscription = sub?.subscription || null
      }

      return sessionState
    }catch{
      const fallback = { loading:false, configured:true, user:cachedAuthState?.user || cachedUser || null }
      emitAuthState(fallback)
      return fallback
    }
  })()

  return authBootstrapPromise
}

export function useAuthState(){
  const configured = hasSupabaseBrowser()
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const [state,setState] = useState(() => {
    if(cachedAuthState) return cachedAuthState
    const cachedUser = readCachedUser()
    return cachedUser ? { loading:false, configured, user:cachedUser } : { loading:true, configured, user:null }
  })

  useEffect(()=>{
    const unsubscribe = subscribeAuthState(setState)
    bootstrapAuth(supabase, configured)
    return unsubscribe
  }, [configured, supabase])

  async function signOut(){
    if(!supabase) return
    try{
      await supabase.auth.signOut()
    }finally{
      emitAuthState({ loading:false, configured:true, user:null })
      if(typeof window !== 'undefined') window.dispatchEvent(new Event('anime:user-updated'))
    }
  }

  return { ...state, supabase, signOut }
}
