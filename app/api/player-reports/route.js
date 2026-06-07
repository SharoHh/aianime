import '@/lib/runtimeEnv'
import { NextResponse } from 'next/server'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'

function json(data, status = 200){
  return NextResponse.json(data, {
    status,
    headers:{
      'Cache-Control':'no-store, max-age=0',
      'X-Robots-Tag':'noindex, nofollow'
    }
  })
}

function clean(value, max = 500){
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function cleanSlug(value){
  return clean(value, 220).replace(/[^a-zA-Z0-9а-яА-ЯёЁ._~:/?#\[\]@!$&'()*+,;=%-]/g, '')
}

function cleanReason(value){
  const allowed = new Set(['not_loading', 'wrong_episode', 'wrong_voice', 'bad_quality', 'other'])
  const reason = clean(value, 40)
  return allowed.has(reason) ? reason : 'other'
}

function readBearer(request){
  const header = request.headers.get('authorization') || ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

async function getUserByToken(token){
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if(!url || !anon || !token) return null

  try{
    const res = await fetch(`${url}/auth/v1/user`, {
      cache:'no-store',
      headers:{ apikey:anon, Authorization:`Bearer ${token}` }
    })
    if(!res.ok) return null
    const user = await res.json()
    return user?.id ? user : null
  }catch{
    return null
  }
}

function tableMissingError(text = ''){
  return /player_reports|relation .* does not exist|schema cache|PGRST205|42P01/i.test(String(text || ''))
}

function mapReport(item){
  return {
    id:item.id,
    slug:item.anime_slug,
    title:item.anime_title || item.anime_slug,
    episode:Number(item.episode_number || 0) || null,
    voice:item.voice || '',
    reason:item.reason || 'other',
    reasonLabel:item.reason_label || '',
    message:item.message || '',
    status:item.status || 'open',
    createdAt:item.created_at,
    updatedAt:item.updated_at
  }
}

export async function POST(request){
  try{
    if(!hasSupabase()) return json({ ok:false, error:'Supabase env is not configured' }, 400)
    const body = await request.json().catch(() => ({}))
    const slug = cleanSlug(body.slug)
    const title = clean(body.title || slug, 220)
    const episode = Math.max(1, Number(body.episode || 1) || 1)
    const voice = clean(body.voice, 160)
    const reason = cleanReason(body.reason)
    const reasonLabel = clean(body.reasonLabel, 120)
    const message = clean(body.message, 500)
    const clientId = clean(body.clientId, 120)
    const pageUrl = clean(body.pageUrl, 600)

    if(!slug) return json({ ok:false, error:'slug is required' }, 400)

    const user = await getUserByToken(readBearer(request))
    const meta = user?.user_metadata || {}
    const userName = clean(meta.name || meta.full_name || meta.display_name || user?.email?.split('@')?.[0] || '', 120)

    const payload = {
      anime_slug: slug,
      anime_title: title,
      episode_number: episode,
      voice,
      reason,
      reason_label: reasonLabel,
      message,
      page_url: pageUrl,
      user_id: user?.id || null,
      user_email: user?.email || null,
      user_name: userName || null,
      client_id: user?.id ? null : clientId,
      status:'open',
      created_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    }

    const res = await supabaseRequest('player_reports', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Prefer:'return=representation' },
      body:JSON.stringify(payload),
      timeout:10000
    })
    const text = await res.text()
    let data = null
    try{ data = text ? JSON.parse(text) : null }catch{}
    if(!res.ok){
      if(tableMissingError(text)) return json({ ok:false, error:'Нужно выполнить SQL-миграцию player_reports в Supabase' }, 500)
      return json({ ok:false, error:text || `Supabase error ${res.status}` }, 500)
    }

    const item = Array.isArray(data) ? data[0] : data
    return json({ ok:true, report:item ? mapReport(item) : null })
  }catch(error){
    return json({ ok:false, error:error?.message || 'Unknown error' }, 500)
  }
}
