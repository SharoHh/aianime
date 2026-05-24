import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseRuntimeEnabled = process.env.NEXT_PUBLIC_ENABLE_SUPABASE_RUNTIME === '1'

export function hasSupabaseBrowser(){
  return Boolean(supabaseRuntimeEnabled && supabaseUrl && supabaseAnonKey)
}

export function createBrowserSupabase(){
  if(!hasSupabaseBrowser()) return null
  return createClient(supabaseUrl, supabaseAnonKey)
}
