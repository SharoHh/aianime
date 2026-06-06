import { createClient } from '@supabase/supabase-js'

const buildSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const buildSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const RUNTIME_CONFIG_KEY = 'anime:supabase-runtime-config'

const runtimeState = globalThis.__AIANIME_SUPABASE_RUNTIME_CONFIG__ || { config:null, promise:null }
globalThis.__AIANIME_SUPABASE_RUNTIME_CONFIG__ = runtimeState

let browserSupabaseClient = null
let browserSupabaseClientKey = ''

function cleanConfig(config){
  const supabaseUrl = String(config?.supabaseUrl || config?.url || '').trim()
  const supabaseAnonKey = String(config?.supabaseAnonKey || config?.anonKey || '').trim()
  if(!supabaseUrl || !supabaseAnonKey) return null
  return { supabaseUrl, supabaseAnonKey }
}

function readStoredRuntimeConfig(){
  if(typeof window === 'undefined') return null
  try{
    const raw = window.localStorage.getItem(RUNTIME_CONFIG_KEY)
    if(!raw) return null
    return cleanConfig(JSON.parse(raw))
  }catch{
    return null
  }
}

export function setRuntimeSupabaseConfig(config){
  const clean = cleanConfig(config)
  if(!clean) return null
  runtimeState.config = clean
  if(typeof window !== 'undefined'){
    try{
      window.localStorage.setItem(RUNTIME_CONFIG_KEY, JSON.stringify(clean))
    }catch{}
  }
  return clean
}

export function getRuntimeSupabaseConfig(){
  return cleanConfig(runtimeState.config) || readStoredRuntimeConfig()
}

function normalizeRuntimeConfig(config){
  return cleanConfig(config) || getRuntimeSupabaseConfig() || cleanConfig({
    supabaseUrl: buildSupabaseUrl,
    supabaseAnonKey: buildSupabaseAnonKey
  }) || { supabaseUrl:'', supabaseAnonKey:'' }
}

export function getBuildSupabaseConfig(){
  return cleanConfig({
    supabaseUrl: buildSupabaseUrl,
    supabaseAnonKey: buildSupabaseAnonKey
  }) || { supabaseUrl:'', supabaseAnonKey:'' }
}

export function getSupabaseConfig(){
  return normalizeRuntimeConfig(null)
}

export async function fetchRuntimeSupabaseConfig({ force = false } = {}){
  const existing = force ? null : getRuntimeSupabaseConfig()
  if(existing) return existing
  if(typeof window === 'undefined') return null

  if(runtimeState.promise && !force) return runtimeState.promise

  runtimeState.promise = fetch('/api/auth/public-config', {
    cache:'no-store',
    headers:{ accept:'application/json' }
  })
    .then(async response => {
      const data = await response.json().catch(() => ({}))
      if(!response.ok || !data?.ok) return null
      return setRuntimeSupabaseConfig({
        supabaseUrl:data.supabaseUrl,
        supabaseAnonKey:data.supabaseAnonKey
      })
    })
    .catch(() => null)
    .finally(() => {
      runtimeState.promise = null
    })

  return runtimeState.promise
}

export function hasSupabaseBrowser(config){
  const { supabaseUrl, supabaseAnonKey } = normalizeRuntimeConfig(config)
  return Boolean(supabaseUrl && supabaseAnonKey)
}

export function createBrowserSupabase(config){
  const { supabaseUrl, supabaseAnonKey } = normalizeRuntimeConfig(config)
  if(!supabaseUrl || !supabaseAnonKey) return null

  if(typeof window === 'undefined') return createClient(supabaseUrl, supabaseAnonKey)

  const nextKey = `${supabaseUrl}|${supabaseAnonKey.slice(0, 12)}`

  if(!browserSupabaseClient || browserSupabaseClientKey !== nextKey){
    browserSupabaseClientKey = nextKey
    browserSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  }

  return browserSupabaseClient
}
