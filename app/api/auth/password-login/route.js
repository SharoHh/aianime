import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 12
const rateStore = globalThis.__AIANIME_AUTH_LOGIN_RATE__ || new Map()
globalThis.__AIANIME_AUTH_LOGIN_RATE__ = rateStore

function getClientIp(req){
  const forwarded = req.headers.get('x-forwarded-for') || ''
  return forwarded.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local'
}

function rateLimit(ip){
  const now = Date.now()
  const bucket = rateStore.get(ip) || { count:0, resetAt:now + RATE_LIMIT_WINDOW_MS }
  if(now > bucket.resetAt){
    bucket.count = 0
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS
  }
  bucket.count += 1
  rateStore.set(ip, bucket)
  return bucket.count <= RATE_LIMIT_MAX
}

function authMessage(message){
  const text = String(message || '')
  const lower = text.toLowerCase()
  if(lower.includes('invalid login')) return 'Неверный email или пароль.'
  if(lower.includes('email not confirmed')) return 'Email ещё не подтверждён. Проверь почту.'
  if(lower.includes('rate limit')) return 'Слишком много попыток. Подожди минуту и попробуй снова.'
  return text || 'Ошибка авторизации.'
}

export async function POST(req){
  try{
    const ip = getClientIp(req)
    if(!rateLimit(ip)){
      return NextResponse.json({ ok:false, error:'Слишком много попыток. Подожди минуту и попробуй снова.' }, { status:429 })
    }

    const body = await req.json().catch(() => ({}))
    const email = String(body?.email || '').trim()
    const password = String(body?.password || '')

    if(!email || !password){
      return NextResponse.json({ ok:false, error:'Укажи email и пароль.' }, { status:400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLIC_ANON_KEY

    if(!supabaseUrl || !anonKey){
      return NextResponse.json({ ok:false, error:'Supabase Auth не подключён: на сервере нет Supabase URL или anon key.' }, { status:500 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 9000)

    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
      method:'POST',
      headers:{
        apikey:anonKey,
        authorization:`Bearer ${anonKey}`,
        'content-type':'application/json'
      },
      body:JSON.stringify({ email, password }),
      signal:controller.signal,
      cache:'no-store'
    }).finally(() => clearTimeout(timeout))

    const data = await response.json().catch(() => ({}))

    if(!response.ok){
      return NextResponse.json({ ok:false, error:authMessage(data?.error_description || data?.msg || data?.message || data?.error) }, { status:response.status })
    }

    const session = {
      access_token:data.access_token,
      refresh_token:data.refresh_token,
      expires_in:data.expires_in,
      expires_at:data.expires_at,
      token_type:data.token_type,
      user:data.user || null
    }

    if(!session.access_token || !session.refresh_token){
      return NextResponse.json({ ok:false, error:'Supabase не вернул сессию.' }, { status:502 })
    }

    return NextResponse.json({ ok:true, user:data.user || null, session })
  }catch(error){
    const aborted = error?.name === 'AbortError'
    return NextResponse.json({ ok:false, error:aborted ? 'Supabase долго отвечает. Попробуй ещё раз.' : (error?.message || 'Не удалось войти.') }, { status:aborted ? 504 : 500 })
  }
}
