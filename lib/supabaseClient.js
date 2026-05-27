import { createClient } from '@supabase/supabase-js'

const buildSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const buildSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let browserSupabaseClient = null
let browserSupabaseClientKey = ''

function normalizeRuntimeConfig(config){
  const supabaseUrl = String(config?.supabaseUrl || config?.url || buildSupabaseUrl || '').trim()
  const supabaseAnonKey = String(config?.supabaseAnonKey || config?.anonKey || buildSupabaseAnonKey || '').trim()
  return { supabaseUrl, supabaseAnonKey }
}

export function getBuildSupabaseConfig(){
  return normalizeRuntimeConfig(null)
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

  // Один браузерный клиент на всё приложение. Если настройки пришли из runtime API,
  // пересоздаём клиент только при смене URL/key.
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
