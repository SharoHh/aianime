import { NextResponse } from 'next/server'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'

function json(data, status = 200){
  return NextResponse.json(data, { status })
}

function clean(value, max = 500){
  return String(value || '').trim().slice(0, max)
}

function mapComment(item){
  return {
    id:item.id,
    slug:item.anime_slug,
    userId:item.user_id,
    author:item.user_name || 'Пользователь Aianime',
    text:item.text || '',
    status:item.status || 'published',
    likes:Number(item.likes || 0),
    createdAt:item.created_at,
    updatedAt:item.updated_at
  }
}

export async function GET(request){
  try{
    if(!hasSupabase()) return json({ ok:false, error:'Supabase env is not configured' }, 400)
    const { searchParams } = new URL(request.url)
    const status = clean(searchParams.get('status') || 'all', 40)
    const slug = clean(searchParams.get('slug'), 220)
    const query = [
      'select=id,anime_slug,user_id,user_name,text,status,likes,created_at,updated_at',
      'order=created_at.desc',
      'limit=200'
    ]
    if(status && status !== 'all') query.push(`status=eq.${encodeURIComponent(status)}`)
    if(slug) query.push(`anime_slug=eq.${encodeURIComponent(slug)}`)

    const res = await supabaseRequest(`anime_comments?${query.join('&')}`, { timeout:10000 })
    const text = await res.text()
    let data = []
    try{ data = text ? JSON.parse(text) : [] }catch{}
    if(!res.ok) return json({ ok:false, error:text || `Supabase error ${res.status}` }, 500)

    return json({ ok:true, comments:Array.isArray(data) ? data.map(mapComment) : [] })
  }catch(error){
    return json({ ok:false, error:error?.message || 'Unknown error' }, 500)
  }
}

export async function PATCH(request){
  try{
    if(!hasSupabase()) return json({ ok:false, error:'Supabase env is not configured' }, 400)
    const body = await request.json()
    const id = Number(body.id)
    const status = clean(body.status, 40)
    const allowed = new Set(['published', 'hidden', 'deleted'])
    if(!id) return json({ ok:false, error:'id is required' }, 400)
    if(!allowed.has(status)) return json({ ok:false, error:'invalid status' }, 400)

    const payload = { status, updated_at:new Date().toISOString() }
    const res = await supabaseRequest(`anime_comments?id=eq.${id}`, {
      method:'PATCH',
      headers:{ 'Content-Type':'application/json', Prefer:'return=representation' },
      body: JSON.stringify(payload),
      timeout:10000
    })
    const text = await res.text()
    let data = null
    try{ data = text ? JSON.parse(text) : null }catch{}
    if(!res.ok) return json({ ok:false, error:text || `Supabase error ${res.status}` }, 500)
    const item = Array.isArray(data) ? data[0] : data
    return json({ ok:true, comment:item ? mapComment(item) : null })
  }catch(error){
    return json({ ok:false, error:error?.message || 'Unknown error' }, 500)
  }
}

export async function DELETE(request){
  try{
    if(!hasSupabase()) return json({ ok:false, error:'Supabase env is not configured' }, 400)
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id'))
    if(!id) return json({ ok:false, error:'id is required' }, 400)

    const res = await supabaseRequest(`anime_comments?id=eq.${id}`, {
      method:'DELETE',
      headers:{ Prefer:'return=minimal' },
      timeout:10000
    })
    const text = await res.text()
    if(!res.ok) return json({ ok:false, error:text || `Supabase error ${res.status}` }, 500)
    return json({ ok:true })
  }catch(error){
    return json({ ok:false, error:error?.message || 'Unknown error' }, 500)
  }
}
