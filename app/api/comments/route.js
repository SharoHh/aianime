import { NextResponse } from 'next/server'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'

function json(data, status = 200){
  return NextResponse.json(data, { status })
}

function cleanText(value, max = 1200){
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function cleanSlug(value){
  return String(value || '').trim().slice(0, 220)
}

function readBearer(request){
  const header = request.headers.get('authorization') || ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

async function getUserByToken(token){
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if(!url || !anon || !token) return null

  const res = await fetch(`${url}/auth/v1/user`, {
    cache:'no-store',
    headers:{
      apikey: anon,
      Authorization: `Bearer ${token}`
    }
  })
  if(!res.ok) return null
  const user = await res.json()
  return user?.id ? user : null
}

function displayName(user){
  const meta = user?.user_metadata || {}
  const raw = meta.name || meta.full_name || meta.display_name || user?.email?.split('@')?.[0] || 'Гость Aianime'
  return cleanText(raw, 80) || 'Гость Aianime'
}

function mapComment(item){
  return {
    id:item.id,
    slug:item.anime_slug,
    author:item.user_name || 'Пользователь Aianime',
    text:item.text || '',
    likes:Number(item.likes || 0),
    createdAt:item.created_at,
    status:item.status || 'published'
  }
}

export async function GET(request){
  try{
    const { searchParams } = new URL(request.url)
    const slug = cleanSlug(searchParams.get('slug'))
    if(!slug) return json({ ok:false, error:'slug is required' }, 400)

    if(!hasSupabase()){
      return json({ ok:true, source:'local-fallback', comments:[] })
    }

    const path = `anime_comments?anime_slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=id,anime_slug,user_name,text,likes,status,created_at&order=created_at.desc&limit=50`
    const res = await supabaseRequest(path, { timeout:10000 })
    const text = await res.text()
    let data = []
    try{ data = text ? JSON.parse(text) : [] }catch{}
    if(!res.ok) return json({ ok:false, error:text || `Supabase error ${res.status}` }, 500)

    return json({ ok:true, source:'supabase', comments:Array.isArray(data) ? data.map(mapComment) : [] })
  }catch(error){
    return json({ ok:false, error:error?.message || 'Unknown error' }, 500)
  }
}

export async function POST(request){
  try{
    if(!hasSupabase()) return json({ ok:false, error:'Supabase env is not configured' }, 400)

    const token = readBearer(request)
    const user = await getUserByToken(token)
    if(!user?.id){
      return json({ ok:false, error:'auth required', hint:'Войди в аккаунт, чтобы оставить комментарий.' }, 401)
    }

    const body = await request.json()
    const slug = cleanSlug(body.slug)
    const text = cleanText(body.text)
    if(!slug) return json({ ok:false, error:'slug is required' }, 400)
    if(text.length < 2) return json({ ok:false, error:'Комментарий слишком короткий' }, 400)

    const payload = {
      anime_slug: slug,
      user_id: user.id,
      user_name: displayName(user),
      text,
      status:'published',
      likes:0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const res = await supabaseRequest('anime_comments', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Prefer:'return=representation' },
      body: JSON.stringify(payload),
      timeout:10000
    })
    const responseText = await res.text()
    let data = null
    try{ data = responseText ? JSON.parse(responseText) : null }catch{}
    if(!res.ok) return json({ ok:false, error:responseText || `Supabase error ${res.status}` }, 500)

    const item = Array.isArray(data) ? data[0] : data
    return json({ ok:true, comment: mapComment(item || payload) })
  }catch(error){
    return json({ ok:false, error:error?.message || 'Unknown error' }, 500)
  }
}
