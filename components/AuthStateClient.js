'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserSupabase, hasSupabaseBrowser } from '@/lib/supabaseClient'

export const baseProfileDefaults = {
  name: 'Профиль Aianime',
  level: 'Новый участник',
  avatar: '/posters/oshi.svg',
  cover: '/images/profile-sidebar-bg.png'
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

export function useAuthState(){
  const configured = hasSupabaseBrowser()
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const [state,setState] = useState({ loading:true, configured, user:null })

  useEffect(()=>{
    let alive = true

    if(!configured || !supabase){
      setState({ loading:false, configured:false, user:null })
      return undefined
    }

    supabase.auth.getUser().then(({ data }) => {
      if(alive) setState({ loading:false, configured:true, user:data?.user || null })
    }).catch(() => {
      if(alive) setState({ loading:false, configured:true, user:null })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if(alive) setState({ loading:false, configured:true, user:session?.user || null })
    })

    return () => {
      alive = false
      sub?.subscription?.unsubscribe?.()
    }
  }, [configured, supabase])

  async function signOut(){
    if(!supabase) return
    await supabase.auth.signOut()
    setState(prev => ({ ...prev, user:null, loading:false }))
    window.dispatchEvent(new Event('anime:user-updated'))
  }

  return { ...state, supabase, signOut }
}
