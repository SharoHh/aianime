function isAllowedRemoteImage(url){
  try{
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if(parsed.protocol !== 'https:') return false
    return host === 'cdn.myanimelist.net'
      || host.endsWith('.myanimelist.net')
      || host === 'i.kodikres.com'
      || host.endsWith('.kodikres.com')
      || host === 'shikimori.one'
      || host.endsWith('.shikimori.one')
  }catch{
    return false
  }
}

function fallbackUrl(req){
  const raw = req.nextUrl.searchParams.get('fallback') || '/posters/magic2.svg'
  const safe = String(raw).startsWith('/') && !String(raw).startsWith('//') ? String(raw) : '/posters/magic2.svg'
  return new URL(safe, req.url)
}

function fallback(req){
  return Response.redirect(fallbackUrl(req), 302)
}

async function fetchWithTimeout(url, timeout = 9000){
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try{
    return await fetch(url, {
      signal: controller.signal,
      cache: 'force-cache',
      next: { revalidate: 60 * 60 * 24 * 14 },
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'Aianime image proxy/1.0'
      }
    })
  }finally{
    clearTimeout(timer)
  }
}

export async function GET(req){
  const url = req.nextUrl.searchParams.get('url')
  if(!url) return fallback(req)
  if(!isAllowedRemoteImage(url)) return fallback(req)

  try{
    const res = await fetchWithTimeout(url)
    const type = res.headers.get('content-type') || ''
    if(!res.ok || !type.toLowerCase().startsWith('image/')) return fallback(req)

    const bytes = await res.arrayBuffer()
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=604800, s-maxage=1209600, stale-while-revalidate=86400',
        'X-Aianime-Image-Proxy': '1'
      }
    })
  }catch{
    return fallback(req)
  }
}
