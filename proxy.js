import { NextResponse } from 'next/server'

const buckets = new Map()

function isProd(){
  return process.env.NODE_ENV === 'production'
}

function isLocalRequest(req){
  const host = req.headers.get('host') || ''
  return host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]')
}

function readBearer(req){
  const auth = req.headers.get('authorization') || ''
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
}

function getAdminToken(req){
  const url = req.nextUrl
  return (
    url.searchParams.get('admin_secret') ||
    url.searchParams.get('adminToken') ||
    req.headers.get('x-admin-secret') ||
    readBearer(req) ||
    req.cookies.get('aianime_admin')?.value ||
    req.cookies.get('aianime_admin_api')?.value ||
    ''
  )
}

function getCronToken(req){
  const url = req.nextUrl
  return (
    url.searchParams.get('token') ||
    req.headers.get('x-cron-token') ||
    readBearer(req) ||
    ''
  )
}

function json(data, status = 200, extraHeaders = {}){
  return NextResponse.json(data, { status, headers: extraHeaders })
}

function adminDenied(req, reason = 'Admin access denied'){
  if(req.nextUrl.pathname.startsWith('/api/')){
    return json({
      ok:false,
      error: reason,
      hint:'Добавь ADMIN_SECRET в Vercel env и открывай /admin/diagnostics?admin_secret=ADMIN_SECRET. Для API можно использовать header x-admin-secret.'
    }, 401)
  }

  return new NextResponse(`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AIanime admin locked</title>
    <style>
      body{font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;background:#fff7fb;color:#2d1b25;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}
      main{max-width:560px;background:rgba(255,255,255,.86);border:1px solid rgba(246,157,202,.35);box-shadow:0 20px 70px rgba(216,75,150,.12);border-radius:28px;padding:28px}
      h1{font-size:26px;line-height:1.1;margin:0 0 12px;font-weight:800;letter-spacing:-.04em}
      p{font-size:15px;line-height:1.6;color:rgba(70,44,58,.76);margin:0 0 12px}
      code{background:#fff0f8;border:1px solid rgba(236,134,194,.25);padding:2px 6px;border-radius:8px;color:#b83286}
    </style>
  </head>
  <body>
    <main>
      <h1>Админка защищена</h1>
      <p>Открой админку с параметром <code>?admin_secret=ADMIN_SECRET</code> или добавь header <code>x-admin-secret</code>.</p>
      <p>На Vercel добавь переменную окружения <code>ADMIN_SECRET</code>. На localhost без production админка может открываться без секрета.</p>
    </main>
  </body>
</html>`, {
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })
}

function adminConfigured(){
  return Boolean(process.env.ADMIN_SECRET)
}

function verifyAdmin(req){
  const local = isLocalRequest(req)
  const secret = process.env.ADMIN_SECRET || ''

  if(local && !isProd()){
    return { ok:true, mode:'local-bypass', setCookie:false }
  }

  if(!secret){
    return { ok:false, reason:'ADMIN_SECRET is not configured' }
  }

  const token = getAdminToken(req)
  if(token && token === secret){
    return { ok:true, mode:'secret', setCookie:true }
  }

  return { ok:false, reason:'Invalid admin secret' }
}

function verifyCron(req){
  const local = isLocalRequest(req)
  const secret = process.env.CRON_SECRET || ''

  if(local && !isProd()){
    return { ok:true, mode:'local-bypass' }
  }

  if(!secret){
    return { ok:false, reason:'CRON_SECRET is not configured' }
  }

  const token = getCronToken(req)
  if(token && token === secret){
    return { ok:true, mode:'token' }
  }

  return { ok:false, reason:'Invalid cron token' }
}

function getIp(req){
  const forwarded = req.headers.get('x-forwarded-for') || ''
  const first = forwarded.split(',')[0]?.trim()
  return first || req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || 'unknown'
}

function rateLimit(req, { name, limit, windowMs }){
  const now = Date.now()
  const ip = getIp(req)
  const key = `${name}:${ip}`
  const current = buckets.get(key)

  if(!current || current.resetAt <= now){
    buckets.set(key, { count:1, resetAt: now + windowMs })
    return { ok:true, limit, remaining: limit - 1, resetAt: now + windowMs }
  }

  current.count += 1
  buckets.set(key, current)

  const remaining = Math.max(0, limit - current.count)
  if(current.count > limit){
    return { ok:false, limit, remaining:0, resetAt:current.resetAt, retryAfter: Math.ceil((current.resetAt - now) / 1000) }
  }

  return { ok:true, limit, remaining, resetAt: current.resetAt }
}

function cleanupOldBuckets(){
  const now = Date.now()
  if(buckets.size < 5000) return
  for(const [key, value] of buckets.entries()){
    if(value.resetAt <= now) buckets.delete(key)
  }
}

function rateLimitConfig(pathname){
  if(pathname.startsWith('/api/ai')) return { name:'ai', limit:30, windowMs:60_000 }
  if(pathname.startsWith('/api/player')) return { name:'player', limit:80, windowMs:60_000 }
  if(pathname.startsWith('/api/comments')) return { name:'comments', limit:35, windowMs:60_000 }
  if(pathname.startsWith('/api/presence')) return { name:'presence', limit:120, windowMs:60_000 }
  if(pathname.startsWith('/api/poster') || pathname.startsWith('/api/image')) return { name:'image', limit:180, windowMs:60_000 }
  if(pathname.startsWith('/api/moderate-image')) return { name:'moderate-image', limit:20, windowMs:60_000 }
  return null
}

function withSecurityHeaders(response){
  response.headers.set('x-content-type-options', 'nosniff')
  response.headers.set('x-frame-options', 'SAMEORIGIN')
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin')
  response.headers.set('x-aianime-security', 'enabled')
  return response
}

function isPublicHtmlPath(pathname = ''){
  const path = String(pathname || '/')
  if(!path || path.startsWith('/api') || path.startsWith('/admin')) return false
  if(path.startsWith('/_next') || path.startsWith('/images') || path.startsWith('/posters')) return false
  if(path === '/' || path === '/catalog' || path === '/collections' || path === '/genres' || path === '/studios' || path === '/schedule' || path === '/season' || path === '/ai' || path === '/ai/quiz') return true
  if(path === '/anime-2023' || path === '/anime-2024' || path === '/anime-2025' || path === '/anime-2026') return true
  if(path.startsWith('/anime/')) return true
  if(path.startsWith('/genre/')) return true
  if(path.startsWith('/studio/')) return true
  if(path === '/top' || path.startsWith('/top/')) return true
  return false
}

function withPublicHtmlCache(response, pathname){
  if(!isPublicHtmlPath(pathname)) return response
  // Не переводим страницы в build-time static, чтобы каталог Supabase не откатывался в seed-40.
  // Просто убираем private/no-store у публичного HTML и даём кэш прокси/CDN/ботам.
  response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600')
  response.headers.set('x-aianime-cache-policy', 'public-html-900')
  return response
}

export function proxy(req){
  const { pathname, searchParams } = req.nextUrl

  if(pathname.startsWith('/admin') || pathname.startsWith('/api/admin')){
    const auth = verifyAdmin(req)
    if(!auth.ok) return adminDenied(req, auth.reason)

    const hasQuerySecret = searchParams.has('admin_secret') || searchParams.has('adminToken')
    if(hasQuerySecret && pathname.startsWith('/admin')){
      const cleanUrl = req.nextUrl.clone()
      cleanUrl.searchParams.delete('admin_secret')
      cleanUrl.searchParams.delete('adminToken')
      const response = NextResponse.redirect(cleanUrl)
      if(adminConfigured()){
        response.cookies.set('aianime_admin', process.env.ADMIN_SECRET, {
          httpOnly:true,
          sameSite:'strict',
          secure:isProd(),
          path:'/admin',
          maxAge:60 * 60 * 12
        })
        response.cookies.set('aianime_admin_api', process.env.ADMIN_SECRET, {
          httpOnly:true,
          sameSite:'strict',
          secure:isProd(),
          path:'/api/admin',
          maxAge:60 * 60 * 12
        })
      }
      return withSecurityHeaders(response)
    }

    const response = NextResponse.next()
    if(auth.setCookie && adminConfigured()){
      response.cookies.set('aianime_admin', process.env.ADMIN_SECRET, {
        httpOnly:true,
        sameSite:'strict',
        secure:isProd(),
        path:'/admin',
        maxAge:60 * 60 * 12
      })
      response.cookies.set('aianime_admin_api', process.env.ADMIN_SECRET, {
        httpOnly:true,
        sameSite:'strict',
        secure:isProd(),
        path:'/api/admin',
        maxAge:60 * 60 * 12
      })
    }
    return withSecurityHeaders(response)
  }

  if(pathname.startsWith('/api/cron')){
    const auth = verifyCron(req)
    if(!auth.ok){
      return json({
        ok:false,
        error:auth.reason,
        hint:'Для cron используй ?token=CRON_SECRET, header x-cron-token или Authorization: Bearer CRON_SECRET. На localhost dev режим пропускается.'
      }, 401)
    }
    return withSecurityHeaders(NextResponse.next())
  }

  const cfg = rateLimitConfig(pathname)
  if(cfg){
    cleanupOldBuckets()
    const result = rateLimit(req, cfg)
    if(!result.ok){
      return json({
        ok:false,
        error:'Too many requests',
        hint:'Слишком много запросов. Попробуй позже.'
      }, 429, {
        'retry-after': String(result.retryAfter || 60),
        'x-ratelimit-limit': String(result.limit),
        'x-ratelimit-remaining': '0'
      })
    }

    const response = NextResponse.next()
    response.headers.set('x-ratelimit-limit', String(result.limit))
    response.headers.set('x-ratelimit-remaining', String(result.remaining))
    return withSecurityHeaders(response)
  }

  return withPublicHtmlCache(withSecurityHeaders(NextResponse.next()), pathname)
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/:path*',
    '/',
    '/catalog',
    '/collections',
    '/genres',
    '/studios',
    '/schedule',
    '/season',
    '/ai',
    '/ai/quiz',
    '/top/:path*',
    '/anime/:path*',
    '/genre/:path*',
    '/studio/:path*',
    '/anime-2023',
    '/anime-2024',
    '/anime-2025',
    '/anime-2026'
  ]
}
