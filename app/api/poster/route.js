function remoteImagesEnabled(){
  return process.env.ENABLE_REMOTE_IMAGES === '1' || process.env.NEXT_PUBLIC_ENABLE_REMOTE_IMAGES === '1'
}

function localFallback(req){
  const raw = req.nextUrl.searchParams.get('fallback') || '/posters/magic2.svg'
  const safe = String(raw).startsWith('/') && !String(raw).startsWith('//') ? String(raw) : '/posters/magic2.svg'
  return Response.redirect(new URL(safe, req.url), 302)
}

async function fetchWithTimeout(url, options = {}, timeout = 1800){
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try{
    return await fetch(url, { ...options, signal: controller.signal })
  }finally{
    clearTimeout(timer)
  }
}

function pickImage(payload){
  const images = payload?.data?.images || payload?.images || {}
  return images?.webp?.large_image_url ||
    images?.jpg?.large_image_url ||
    images?.webp?.image_url ||
    images?.jpg?.image_url ||
    null
}

export async function GET(req){
  if(!remoteImagesEnabled()) return localFallback(req)

  const id = Number(req.nextUrl.searchParams.get('id'))
  if(!Number.isFinite(id) || id <= 0) return localFallback(req)

  try{
    const res = await fetchWithTimeout(`https://api.jikan.moe/v4/anime/${id}/full`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Aianime/1.0 poster fallback'
      },
      cache: 'force-cache',
      next: { revalidate: 86400 }
    }, 1800)

    if(!res.ok) return localFallback(req)
    const payload = await res.json().catch(() => null)
    const image = pickImage(payload)
    if(!image || !/^https:\/\/cdn\.myanimelist\.net\//i.test(image)) return localFallback(req)

    return Response.redirect(image, 302)
  }catch{
    return localFallback(req)
  }
}
