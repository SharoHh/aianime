export function getCronToken(req){
  const url = req?.nextUrl || new URL(req.url)
  const queryToken = url.searchParams.get('token')
  const headerToken = req.headers?.get?.('x-cron-token')
  const authHeader = req.headers?.get?.('authorization') || ''
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
  return queryToken || headerToken || bearerToken || ''
}

export function isLocalRequest(req){
  const host = req.headers?.get?.('host') || ''
  return host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]')
}

export function verifyCronAccess(req){
  const secret = process.env.CRON_SECRET || ''
  const token = getCronToken(req)
  const local = isLocalRequest(req)

  // Локальная разработка не должна упираться в cron-token.
  // На production защита остаётся: если CRON_SECRET задан, нужен token/header/Bearer.
  if(local && process.env.NODE_ENV !== 'production'){
    return { ok:true, mode:'local-bypass', local:true }
  }

  if(!secret){
    return { ok:true, mode:'no-secret', local }
  }

  if(token === secret){
    return { ok:true, mode:'token', local }
  }

  return {
    ok:false,
    mode:'blocked',
    local,
    error:'Invalid cron token',
    hint:'Для production добавь ?token=CRON_SECRET, header x-cron-token или Authorization: Bearer <CRON_SECRET>. На localhost токен не нужен в dev-режиме.'
  }
}

export function cronAuthError(auth){
  return Response.json({ ok:false, error:auth.error || 'Invalid cron token', hint:auth.hint }, { status:401 })
}
