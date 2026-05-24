function redirectFallback(req){
  return Response.redirect(new URL('/posters/magic2.svg', req.url), 302)
}

function isMalCdnUrl(url){
  return /^https:\/\/cdn\.myanimelist\.net\//i.test(String(url || ''))
}

export async function GET(req){
  const url = req.nextUrl.searchParams.get('url')
  if(!url) return new Response('Bad image url', { status: 400 })

  // Основные постеры AIanime идут только из Jikan / MAL CDN.
  // Любые другие внешние источники не трогаем при открытии сайта.
  if(isMalCdnUrl(url)) return Response.redirect(url, 302)

  return redirectFallback(req)
}
