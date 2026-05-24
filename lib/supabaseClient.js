import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseRuntimeEnabled = process.env.NEXT_PUBLIC_ENABLE_SUPABASE_RUNTIME === '1'

let browserSupabaseClient = null

export function hasSupabaseBrowser(){
  return Boolean(supabaseRuntimeEnabled && supabaseUrl && supabaseAnonKey)
}

export function createBrowserSupabase(){
  if(!hasSupabaseBrowser()) return null
  if(typeof window === 'undefined') return createClient(supabaseUrl, supabaseAnonKey)

  // Один браузерный клиент на всё приложение. Так auth-сессия не теряется
  // при переходах между страницами и возврате на главную через client navigation.
  if(!browserSupabaseClient){
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
