import '@/lib/runtimeEnv'
export function isVercelBuildTime(){
  // Vercel/Next build must not call Supabase/Jikan/Kodik while collecting page data.
  // Runtime API routes and pages will still use Supabase after deploy.
  return process.env.NEXT_PHASE === 'phase-production-build' || process.env.npm_lifecycle_event === 'build'
}

export function isSupabaseRuntimeEnabled(){
  if(isVercelBuildTime()) return false
  return process.env.ENABLE_SUPABASE_RUNTIME === '1' || process.env.NEXT_PUBLIC_ENABLE_SUPABASE_RUNTIME === '1'
}

export function hasSupabase(){
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL
  return Boolean(isSupabaseRuntimeEnabled() && url && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function supabaseRequest(path, options = {}){
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!hasSupabase()) throw new Error('Supabase runtime is disabled or env is not configured')

  const controller = new AbortController()
  const timeout = Number(options.timeout || 10000)
  const timer = setTimeout(() => controller.abort(), timeout)

  try{
    return await fetch(`${url}/rest/v1/${path}`, {
      ...options,
      cache: 'no-store',
      next: { revalidate: 0 },
      signal: controller.signal,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
        ...(options.headers || {})
      }
    })
  }finally{
    clearTimeout(timer)
  }
}
