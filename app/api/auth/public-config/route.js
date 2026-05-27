import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function readSupabasePublicConfig(){
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || process.env.PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLIC_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || ''
  return {
    supabaseUrl: String(supabaseUrl || '').trim(),
    supabaseAnonKey: String(supabaseAnonKey || '').trim()
  }
}

export async function GET(){
  const config = readSupabasePublicConfig()
  const ok = Boolean(config.supabaseUrl && config.supabaseAnonKey)

  return NextResponse.json({
    ok,
    ...config,
    version: 'v63-runtime-auth-config'
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  })
}
