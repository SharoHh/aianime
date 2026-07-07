import '@/lib/runtimeEnv'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const IP_RATE_WINDOW_MS = 60 * 1000
const IP_RATE_MAX = 10
const EMAIL_RATE_WINDOW_MS = 15 * 60 * 1000
const EMAIL_RATE_MAX = 24
const rateStore = globalThis.__AIANIME_AUTH_LOGIN_RATE__ || new Map()
globalThis.__AIANIME_AUTH_LOGIN_RATE__ = rateStore

function json(data, status = 200){
  return NextResponse.json(data, {
    status,
    headers:{
      'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
      Pragma:'no-cache',
      'X-Content-Type-Options':'nosniff'
    }
  })
}

function getClientIp(req){
  const realIp = req.headers.get('x-real-ip')?.trim()
  if(realIp) return realIp
  const forwarded = req.headers.get('x-forwarded-for') || ''
  return forwarded.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'local'
}

function requestOriginAllowed(req){
  const origin = req.headers.get('origin')
  if(!origin) return true
  try{
    const originUrl = new URL(origin)
    const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
    return Boolean(forwardedHost && originUrl.host === forwardedHost)
  }catch{
    return false
  }
}

function consumeRateLimit(key, limit, windowMs){
  const now = Date.now()
  const bucket = rateStore.get(key) || { count:0, resetAt:now + windowMs }
  if(now >= bucket.resetAt){
    bucket.count = 0
    bucket.resetAt = now + windowMs
  }
  bucket.count += 1
  rateStore.set(key, bucket)
  return { ok:bucket.count <= limit, retryAfter:Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
}

function cleanupRateStore(){
  if(rateStore.size < 2000) return
  const now = Date.now()
  for(const [key, value] of rateStore.entries()){
    if(!value || value.resetAt <= now) rateStore.delete(key)
  }
}

function authMessage(message){
  const lower = String(message || '').toLowerCase()
  if(lower.includes('invalid login')) return 'Неверный email или пароль.'
  if(lower.includes('email not confirmed')) return 'Email ещё не подтверждён. Проверь почту.'
  if(lower.includes('rate limit') || lower.includes('too many')) return 'Слишком много попыток. Подожди и попробуй снова.'
  return 'Не удалось войти. Проверь данные и попробуй ещё раз.'
}

function validEmail(value){
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(req){
  try{
    if(!requestOriginAllowed(req)){
      return json({ ok:false, error:'Запрос авторизации отклонён.' }, 403)
    }

    const contentLength = Number(req.headers.get('content-length') || 0)
    if(contentLength > 16_384){
      return json({ ok:false, error:'Слишком большой запрос.' }, 413)
    }

    const body = await req.json().catch(() => ({}))
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')

    if(!validEmail(email) || password.length < 1 || password.length > 1024){
      return json({ ok:false, error:'Проверь email и пароль.' }, 400)
    }

    cleanupRateStore()
    const ip = getClientIp(req)
    const ipLimit = consumeRateLimit(`ip:${ip}`, IP_RATE_MAX, IP_RATE_WINDOW_MS)
    const emailLimit = consumeRateLimit(`email:${email}`, EMAIL_RATE_MAX, EMAIL_RATE_WINDOW_MS)
    if(!ipLimit.ok || !emailLimit.ok){
      const retryAfter = Math.max(ipLimit.retryAfter, emailLimit.retryAfter)
      const response = json({ ok:false, error:'Слишком много попыток. Подожди и попробуй снова.' }, 429)
      response.headers.set('Retry-After', String(retryAfter))
      return response
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || process.env.PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLIC_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY

    if(!supabaseUrl || !anonKey){
      return json({ ok:false, error:'Вход временно недоступен.' }, 503)
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
      return json({ ok:false, error:authMessage(data?.error_description || data?.msg || data?.message || data?.error) }, response.status === 429 ? 429 : 401)
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
      return json({ ok:false, error:'Сервис авторизации не вернул сессию.' }, 502)
    }

    return json({ ok:true, user:data.user || null, session })
  }catch(error){
    const aborted = error?.name === 'AbortError'
    return json({ ok:false, error:aborted ? 'Сервис авторизации долго отвечает. Попробуй ещё раз.' : 'Не удалось войти.' }, aborted ? 504 : 500)
  }
}
