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

function tableMissingError(text = ''){
  return /player_reports|relation .* does not exist|schema cache|PGRST205|42P01/i.test(String(text || ''))
}

function reasonLabel(reason, fallback){
  if(fallback) return fallback
  if(reason === 'not_loading') return 'Видео не грузится'
  if(reason === 'wrong_episode') return 'Не та серия'
  if(reason === 'wrong_voice') return 'Не та озвучка'
  if(reason === 'bad_quality') return 'Плохое качество'
  return 'Другая проблема'
}

function mapReport(item){
  return {
    id:item.id,
    slug:item.anime_slug,
    title:item.anime_title || item.anime_slug,
    episode:Number(item.episode_number || 0) || null,
    voice:item.voice || '',
    reason:item.reason || 'other',
    reasonLabel:reasonLabel(item.reason, item.reason_label),
    message:item.message || '',
    pageUrl:item.page_url || '',
    userId:item.user_id || '',
    userEmail:item.user_email || '',
    userName:item.user_name || '',
    clientId:item.client_id || '',
    status:item.status || 'open',
    adminNote:item.admin_note || '',
    createdAt:item.created_at,
    updatedAt:item.updated_at
  }
}

export async function GET(request){
  try{
    if(!hasSupabase()) return json({ ok:false, error:'Supabase env is not configured' }, 400)
    const { searchParams } = new URL(request.url)
    const status = clean(searchParams.get('status') || 'open', 40)
    const slug = clean(searchParams.get('slug'), 220)
    const query = [
      'select=id,anime_slug,anime_title,episode_number,voice,reason,reason_label,message,page_url,user_id,user_email,user_name,client_id,status,admin_note,created_at,updated_at',
      'order=created_at.desc',
      'limit=200'
    ]
    if(status && status !== 'all') query.push(`status=eq.${encodeURIComponent(status)}`)
    if(slug) query.push(`anime_slug=eq.${encodeURIComponent(slug)}`)

    const res = await supabaseRequest(`player_reports?${query.join('&')}`, { timeout:10000 })
    const text = await res.text()
    let data = []
    try{ data = text ? JSON.parse(text) : [] }catch{}
    if(!res.ok){
      if(tableMissingError(text)) return json({ ok:false, error:'Таблица player_reports не найдена. Выполни supabase/player_reports_migration.sql' }, 500)
      return json({ ok:false, error:text || `Supabase error ${res.status}` }, 500)
    }
    const reports = Array.isArray(data) ? data.map(mapReport) : []
    const summary = reports.reduce((acc, report) => {
      const key = report.status || 'open'
      acc[key] = (acc[key] || 0) + 1
      acc.all = (acc.all || 0) + 1
      return acc
    }, { all:0, open:0, checking:0, fixed:0, ignored:0 })
    return json({ ok:true, reports, summary })
  }catch(error){
    return json({ ok:false, error:error?.message || 'Unknown error' }, 500)
  }
}

export async function PATCH(request){
  try{
    if(!hasSupabase()) return json({ ok:false, error:'Supabase env is not configured' }, 400)
    const body = await request.json().catch(() => ({}))
    const id = Number(body.id || 0)
    const status = clean(body.status, 40)
    const adminNote = clean(body.adminNote, 500)
    const allowed = new Set(['open', 'checking', 'fixed', 'ignored'])
    if(!id) return json({ ok:false, error:'id is required' }, 400)
    if(!allowed.has(status)) return json({ ok:false, error:'invalid status' }, 400)

    const payload = { status, admin_note:adminNote, updated_at:new Date().toISOString() }
    const res = await supabaseRequest(`player_reports?id=eq.${encodeURIComponent(id)}`, {
      method:'PATCH',
      headers:{ 'Content-Type':'application/json', Prefer:'return=representation' },
      body:JSON.stringify(payload),
      timeout:10000
    })
    const text = await res.text()
    let data = null
    try{ data = text ? JSON.parse(text) : null }catch{}
    if(!res.ok) return json({ ok:false, error:text || `Supabase error ${res.status}` }, 500)
    const item = Array.isArray(data) ? data[0] : data
    return json({ ok:true, report:item ? mapReport(item) : null })
  }catch(error){
    return json({ ok:false, error:error?.message || 'Unknown error' }, 500)
  }
}

export async function DELETE(request){
  try{
    if(!hasSupabase()) return json({ ok:false, error:'Supabase env is not configured' }, 400)
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id') || 0)
    if(!id) return json({ ok:false, error:'id is required' }, 400)
    const res = await supabaseRequest(`player_reports?id=eq.${encodeURIComponent(id)}`, {
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
