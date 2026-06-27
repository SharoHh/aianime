'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserSupabase, fetchRuntimeSupabaseConfig, getSupabaseConfig, hasSupabaseBrowser } from '@/lib/supabaseClient'
import { prepareLocalAccountData, resetLocalAccountState } from '@/lib/userStorage'

export const baseProfileDefaults = {
  name: 'Профиль Aianime',
  level: 'Новый участник',
  avatar: '/posters/oshi.svg',
  cover: ''
}

const AUTH_USER_CACHE_KEY = 'anime:auth-user-cache'
const PENDING_AUTH_SESSION_KEY = 'anime:pending-auth-session'
const PENDING_AUTH_MAX_AGE_MS = 5 * 60 * 1000

const obsoleteProfileCovers = new Set([
  '/images/profile-sidebar-bg-960.webp',
  '/images/profile-sidebar-bg.webp'
])

export function normalizeProfileCover(value){
  const text = String(value || '').trim()
  if(!text || obsoleteProfileCovers.has(text)) return ''
  return text
}

function normalizeProfileData(user, profile){
  const next = { ...getProfileDefaults(user), ...(profile || {}) }
  return { ...next, cover:normalizeProfileCover(next.cover) }
}

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
    if(scoped) return normalizeProfileData(user, JSON.parse(scoped))

    const legacy = localStorage.getItem('anime:profile')
    if(legacy) return normalizeProfileData(user, JSON.parse(legacy))
  }catch{}
  return defaults
}

export function saveStoredProfile(user, profile){
  if(typeof window === 'undefined') return
  const next = normalizeProfileData(user, profile)
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


function readPendingAuthSession(){
  if(typeof window === 'undefined') return null
  try{
    const raw = sessionStorage.getItem(PENDING_AUTH_SESSION_KEY) || localStorage.getItem(PENDING_AUTH_SESSION_KEY)
    if(!raw) return null
    const parsed = JSON.parse(raw)
    if(!parsed?.access_token || !parsed?.refresh_token) return null
    if(parsed.createdAt && Date.now() - Number(parsed.createdAt) > PENDING_AUTH_MAX_AGE_MS){
      sessionStorage.removeItem(PENDING_AUTH_SESSION_KEY)
      localStorage.removeItem(PENDING_AUTH_SESSION_KEY)
      return null
    }
    return parsed
  }catch{
    return null
  }
}

function clearPendingAuthSession(){
  if(typeof window === 'undefined') return
  try{
    sessionStorage.removeItem(PENDING_AUTH_SESSION_KEY)
    localStorage.removeItem(PENDING_AUTH_SESSION_KEY)
  }catch{}
}

export function setPendingAuthSession(session, user = null){
  if(typeof window === 'undefined' || !session?.access_token || !session?.refresh_token) return null
  const payload = {
    access_token:session.access_token,
    refresh_token:session.refresh_token,
    expires_at:session.expires_at || Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600),
    expires_in:session.expires_in || 3600,
    token_type:session.token_type || 'bearer',
    user:user || session.user || null,
    createdAt:Date.now()
  }
  try{
    const raw = JSON.stringify(payload)
    sessionStorage.setItem(PENDING_AUTH_SESSION_KEY, raw)
    localStorage.setItem(PENDING_AUTH_SESSION_KEY, raw)
  }catch{}
  if(payload.user) writeCachedUser(payload.user)
  return payload
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
  if(next?.user?.id) prepareLocalAccountData(next.user.id)
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

export function setImmediateAuthUser(user){
  authBootstrapPromise = null
  const next = { loading:false, configured:hasSupabaseBrowser(), user:user || null }
  emitAuthState(next)
  if(typeof window !== 'undefined') window.dispatchEvent(new Event('anime:user-updated'))
  return next
}

function bootstrapAuth(supabase, configured){
  if(!configured || !supabase){
    const next = { loading:false, configured:false, user:null }
    emitAuthState(next)
    return Promise.resolve(next)
  }

  if(authBootstrapPromise) return authBootstrapPromise

  authBootstrapPromise = (async () => {
    const pendingAuth = readPendingAuthSession()
    const cachedUser = readCachedUser() || pendingAuth?.user || null

    // Быстрый промежуточный стейт: если пользователь уже был известен, профиль
    // и сайдбар не исчезают на переходах, пока Supabase проверяет сессию.
    if(cachedUser){
      emitAuthState({ loading:false, configured:true, user:cachedUser })
    }

    try{
      const sessionResult = await withTimeout(
        supabase.auth.getSession(),
        550,
        { data:{ session:null }, error:null, timedOut:true }
      )

      const realSession = sessionResult?.data?.session || null
      const pendingUser = pendingAuth?.user || null
      const sessionUser = normalizeUserFromSession(realSession) || cachedUser || pendingUser || null
      const sessionState = { loading:false, configured:true, user:sessionUser }
      emitAuthState(sessionState)

      if(!realSession && pendingAuth?.access_token && pendingAuth?.refresh_token){
        supabase.auth.setSession({
          access_token:pendingAuth.access_token,
          refresh_token:pendingAuth.refresh_token
        }).then(({ data }) => {
          const restoredUser = data?.user || data?.session?.user || pendingUser || sessionUser || null
          clearPendingAuthSession()
          emitAuthState({ loading:false, configured:true, user:restoredUser })
          if(typeof window !== 'undefined') window.dispatchEvent(new Event('anime:user-updated'))
        }).catch(() => {
          // Если Supabase долго отвечает, оставляем быстрый pending-user, чтобы профиль не
          // отбрасывало обратно в гостевой экран сразу после входа.
          emitAuthState(sessionState)
        })
      }else if(realSession){
        clearPendingAuthSession()
      }

      // getUser полезен для свежей проверки, но он не должен держать страницу
      // профиля в бесконечном пустом skeleton, если сеть/Supabase отвечает долго.
      withTimeout(
        supabase.auth.getUser(),
        900,
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



function normalizeProfileForCloud(user, profile){
  const next = normalizeProfileData(user, profile)
  return {
    id: user.id,
    email: user.email || null,
    full_name: next.name || null,
    username: next.name || null,
    avatar_url: next.avatar || null,
    banner_url: next.cover || null,
    bio: next.bio || null,
    profile_status: next.level || null,
    profile_payload: next,
    updated_at: new Date().toISOString()
  }
}

function mapCloudProfile(user, row){
  const defaults = getProfileDefaults(user)
  const payload = row?.profile_payload && typeof row.profile_payload === 'object' ? row.profile_payload : {}
  return {
    ...defaults,
    ...payload,
    name: payload.name || row?.full_name || row?.username || defaults.name,
    level: payload.level || row?.profile_status || defaults.level,
    avatar: payload.avatar || row?.avatar_url || defaults.avatar,
    cover: normalizeProfileCover(payload.cover || row?.banner_url || defaults.cover),
    bio: payload.bio || row?.bio || ''
  }
}

export async function saveProfileToCloud(user, profile, supabaseInput = null){
  if(!user?.id) return { ok:false, skipped:true }
  const supabase = supabaseInput || createBrowserSupabase()
  if(!supabase) return { ok:false, skipped:true }
  const payload = normalizeProfileForCloud(user, profile)

  const { error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict:'id' })

  if(!error) return { ok:true }

  // На старой схеме может не быть profile_status/profile_payload. Сохраняем базовые поля.
  const fallback = {
    id: user.id,
    email: user.email || null,
    full_name: payload.full_name,
    username: payload.username,
    avatar_url: payload.avatar_url,
    banner_url: payload.banner_url,
    bio: payload.bio,
    updated_at: payload.updated_at
  }
  const retry = await supabase.from('profiles').upsert(fallback, { onConflict:'id' })
  if(retry.error) throw retry.error
  return { ok:true, fallback:true }
}

export async function restoreProfileFromCloud(user, supabaseInput = null){
  if(!user?.id) return { ok:false, skipped:true }
  const supabase = supabaseInput || createBrowserSupabase()
  if(!supabase) return { ok:false, skipped:true }

  let result = await supabase
    .from('profiles')
    .select('id,email,full_name,username,avatar_url,banner_url,bio,profile_status,profile_payload,updated_at')
    .eq('id', user.id)
    .maybeSingle()

  if(result.error){
    result = await supabase
      .from('profiles')
      .select('id,email,full_name,username,avatar_url,banner_url,bio,updated_at')
      .eq('id', user.id)
      .maybeSingle()
  }

  if(result.error) throw result.error
  if(!result.data) return { ok:false, missing:true }

  const profile = mapCloudProfile(user, result.data)
  saveStoredProfile(user, profile)
  return { ok:true, profile }
}

export function useAuthState(){
  const [runtimeConfig,setRuntimeConfig] = useState(() => getSupabaseConfig())
  const configured = hasSupabaseBrowser(runtimeConfig)
  const supabase = useMemo(() => createBrowserSupabase(runtimeConfig), [runtimeConfig])
  const [configChecked,setConfigChecked] = useState(() => configured)
  const [state,setState] = useState(() => {
    if(cachedAuthState) return cachedAuthState
    const pendingAuth = readPendingAuthSession()
    const cachedUser = readCachedUser() || pendingAuth?.user || null
    if(cachedUser) return { loading:false, configured:configured || true, user:cachedUser }
    return { loading:true, configured, user:null }
  })

  useEffect(()=>{
    return subscribeAuthState(setState)
  }, [])

  useEffect(()=>{
    let alive = true

    if(configured && supabase){
      setConfigChecked(true)
      bootstrapAuth(supabase, true)
      return () => { alive = false }
    }

    setConfigChecked(false)
    fetchRuntimeSupabaseConfig({ force:true })
      .then(config => {
        if(!alive) return
        if(config){
          setRuntimeConfig(config)
          setConfigChecked(true)
          return
        }

        const cachedUser = readCachedUser()
        setConfigChecked(true)
        emitAuthState({ loading:false, configured:false, user:cachedUser || null })
      })
      .catch(() => {
        if(!alive) return
        const cachedUser = readCachedUser()
        setConfigChecked(true)
        emitAuthState({ loading:false, configured:false, user:cachedUser || null })
      })

    return () => { alive = false }
  }, [configured, supabase])

  async function signOut(){
    // UI должен выйти сразу, не ждать Supabase-сеть.
    // Сессия чистится локально, а сетевой signOut идёт в фоне.
    clearPendingAuthSession()
    resetLocalAccountState()
    emitAuthState({ loading:false, configured:true, user:null })
    authBootstrapPromise = null
    if(typeof window !== 'undefined') window.dispatchEvent(new Event('anime:user-updated'))

    if(!supabase) return
    try{
      await withTimeout(
        supabase.auth.signOut({ scope:'local' }),
        650,
        { error:null, timedOut:true }
      )
    }catch{}
  }

  const waitingForRuntimeConfig = !configChecked && !configured

  return {
    ...state,
    configured:configured || state.configured,
    loading:waitingForRuntimeConfig ? true : state.loading,
    supabase,
    signOut
  }
}
