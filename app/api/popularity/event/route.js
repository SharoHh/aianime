// AIanime v123: lightweight popularity event endpoint.
import { NextResponse } from 'next/server'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'

const ALLOWED_TYPES = new Set(['view','click','continue','favorite','rating'])

function json(payload, status = 200){
  return NextResponse.json(payload, { status })
}

export async function POST(request){
  try{
    const body = await request.json().catch(() => ({}))
    const slug = String(body?.slug || '').trim().slice(0, 180)
    const eventType = String(body?.type || 'view').trim().toLowerCase()
    if(!slug) return json({ ok:false, error:'missing_slug' }, 400)
    if(!ALLOWED_TYPES.has(eventType)) return json({ ok:false, error:'bad_type' }, 400)
    if(!hasSupabase()) return json({ ok:true, skipped:true, reason:'supabase_disabled' })

    const payload = {
      anime_slug: slug,
      event_type: eventType,
      page: String(body?.page || '').slice(0, 260) || null,
      created_at: new Date().toISOString()
    }

    const res = await supabaseRequest('anime_popularity_events', {
      method:'POST',
      timeout:2200,
      headers:{ Prefer:'return=minimal' },
      body: JSON.stringify(payload)
    })

    if(!res.ok) return json({ ok:true, skipped:true, status:res.status })
    return json({ ok:true })
  }catch(error){
    return json({ ok:true, skipped:true, error:error?.message || 'event_failed' })
  }
}
