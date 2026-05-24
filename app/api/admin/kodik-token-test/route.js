function maskToken(value){
  const token = String(value || '').trim()
  if(!token) return ''
  if(token.length <= 10) return `${token.slice(0, 2)}***${token.slice(-2)}`
  return `${token.slice(0, 5)}***${token.slice(-4)}`
}

async function fetchWithTimeout(url, options = {}){
  const controller = new AbortController()
  const timeout = Number(options.timeout || 8000)
  const timer = setTimeout(() => controller.abort(), timeout)
  try{
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache:'no-store',
      headers:{
        Accept:'application/json',
        'User-Agent':'Aianime-admin-kodik-token-test/1.0',
        ...(options.headers || {})
      }
    })
    let body = null
    try { body = await res.json() } catch { body = await res.text().catch(() => null) }
    return { ok:res.ok, status:res.status, body }
  }finally{
    clearTimeout(timer)
  }
}

async function testKodikToken(token){
  const cleanToken = String(token || '').trim()
  if(!cleanToken){
    return {
      ok:false,
      configured:false,
      status:null,
      results:0,
      message:'Kodik token не указан.'
    }
  }

  const search = new URLSearchParams()
  search.set('token', cleanToken)
  search.set('limit', '1')
  search.set('types', 'anime,anime-serial')
  search.set('with_material_data', 'false')
  search.set('title', 'Naruto')

  try{
    const res = await fetchWithTimeout(`https://kodik-api.com/search?${search.toString()}`, { timeout: 8500 })
    const results = Array.isArray(res.body?.results) ? res.body.results.length : 0
    const apiError = res.body?.error || res.body?.message || null

    return {
      ok:Boolean(res.ok && !apiError),
      configured:true,
      status:res.status,
      results,
      tokenMask:maskToken(cleanToken),
      message:res.ok && !apiError
        ? `Kodik отвечает. Тестовых результатов: ${results}.`
        : `Kodik вернул ошибку${apiError ? `: ${apiError}` : ''}`,
    }
  }catch(error){
    return {
      ok:false,
      configured:true,
      status:null,
      results:0,
      tokenMask:maskToken(cleanToken),
      message:error?.name === 'AbortError'
        ? 'Kodik не ответил за timeout. Проверь VPN/доступ к kodik-api.com.'
        : (error?.message || String(error))
    }
  }
}

export async function GET(){
  const token = process.env.KODIK_TOKEN || ''
  const result = await testKodikToken(token)
  return Response.json({
    ok:result.ok,
    source:'env',
    hasEnvToken:Boolean(token),
    ...result
  })
}

export async function POST(req){
  let body = {}
  try{ body = await req.json() }catch{}
  const result = await testKodikToken(body?.token || '')
  return Response.json({
    ok:result.ok,
    source:'manual-check',
    saved:false,
    hint:'Токен не сохраняется через API. Если проверка успешна — вставь его в .env.local как KODIK_TOKEN и перезапусти npm run dev.',
    ...result
  })
}
