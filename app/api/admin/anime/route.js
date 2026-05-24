import { NextResponse } from 'next/server'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'

function cleanString(value){
  if(value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

function normalizePayload(body){
  const genres = Array.isArray(body.genres)
    ? body.genres.map(x => String(x).trim()).filter(Boolean)
    : String(body.genres || '').split(',').map(x => x.trim()).filter(Boolean)

  return {
    title: cleanString(body.title),
    original_title: cleanString(body.originalTitle || body.original_title),
    description: cleanString(body.description),
    poster_url: cleanString(body.posterUrl || body.poster_url),
    banner_url: cleanString(body.bannerUrl || body.banner_url),
    status: cleanString(body.status),
    kind: cleanString(body.kind),
    year: body.year ? Number(body.year) : null,
    episodes: body.episodes ? Number(body.episodes) : null,
    rating: body.rating ? Number(body.rating) : null,
    genres,
    studio: cleanString(body.studio),
    updated_at: new Date().toISOString()
  }
}

export async function PATCH(request){
  try{
    if(!hasSupabase()){
      return NextResponse.json({ ok:false, error:'Supabase env is not configured' }, { status: 400 })
    }

    const body = await request.json()
    const slug = cleanString(body.slug)

    if(!slug){
      return NextResponse.json({ ok:false, error:'slug is required' }, { status: 400 })
    }

    const payload = normalizePayload(body)
    Object.keys(payload).forEach(key => {
      if(payload[key] === null || payload[key] === undefined || (Array.isArray(payload[key]) && payload[key].length === 0)){
        delete payload[key]
      }
    })

    const tryUpdate = async (table) => {
      const res = await supabaseRequest(`${table}?slug=eq.${encodeURIComponent(slug)}`, {
        method:'PATCH',
        headers:{ 'Content-Type':'application/json', Prefer:'return=representation' },
        body: JSON.stringify(payload),
        timeout: 15000
      })
      const text = await res.text()
      let data = null
      try{ data = text ? JSON.parse(text) : null }catch{}
      return { res, text, data, table }
    }

    let result = await tryUpdate('anime')
    if(!result.res.ok){
      const fallback = await tryUpdate('anime_titles')
      if(fallback.res.ok) result = fallback
    }

    if(!result.res.ok){
      return NextResponse.json({ ok:false, error:`Supabase update failed: ${result.res.status} ${result.text}` }, { status: 500 })
    }

    return NextResponse.json({ ok:true, table:result.table, item:Array.isArray(result.data) ? result.data[0] : result.data })
  }catch(error){
    return NextResponse.json({ ok:false, error:error?.message || 'Unknown error' }, { status: 500 })
  }
}
