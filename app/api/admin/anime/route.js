import { NextResponse } from 'next/server'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { translateGenres, cleanPublicText } from '@/lib/ruContent'

function cleanString(value){
  if(value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

function cleanContentString(value){
  const text = cleanString(value)
  if(!text) return null
  return cleanPublicText(text) || null
}


function cleanUrl(value){
  const text = cleanString(value)
  if(!text) return null
  if(text.startsWith('/api/image?')){
    try{
      const parsed = new URL(text, 'https://aianime.local')
      const raw = parsed.searchParams.get('url')
      return raw || text
    }catch{
      return text
    }
  }
  return text
}

function cleanNumber(value){
  if(value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizePayload(body){
  const rawGenres = Array.isArray(body.genres)
    ? body.genres.map(x => String(x).trim()).filter(Boolean)
    : String(body.genres || '').split(',').map(x => x.trim()).filter(Boolean)
  const genres = translateGenres(rawGenres)

  return {
    title: cleanContentString(body.title || body.titleEnglish),
    title_ru: cleanContentString(body.titleRu || body.title_ru),
    original_title: cleanContentString(body.originalTitle || body.original_title),
    description: cleanContentString(body.description),
    description_ru: cleanContentString(body.descriptionRu || body.description_ru),
    poster_url: cleanUrl(body.posterUrl || body.poster_url),
    banner_url: cleanUrl(body.bannerUrl || body.banner_url),
    status: cleanString(body.status),
    kind: cleanString(body.kind),
    year: cleanNumber(body.year),
    episodes: cleanNumber(body.episodes),
    rating: cleanNumber(body.rating),
    genres,
    studio: cleanString(body.studio),
    updated_at: new Date().toISOString()
  }
}

function stripEmpty(payload){
  const next = { ...payload }
  Object.keys(next).forEach(key => {
    const value = next[key]
    if(value === undefined || value === null || (Array.isArray(value) && value.length === 0)){
      delete next[key]
    }
  })
  return next
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

    const payload = stripEmpty(normalizePayload(body))

    const tryUpdate = async (table, data = payload) => {
      const res = await supabaseRequest(`${table}?slug=eq.${encodeURIComponent(slug)}`, {
        method:'PATCH',
        headers:{ 'Content-Type':'application/json', Prefer:'return=representation' },
        body: JSON.stringify(data),
        timeout: 15000
      })
      const text = await res.text()
      let parsed = null
      try{ parsed = text ? JSON.parse(text) : null }catch{}
      return { res, text, data: parsed, table }
    }

    let result = await tryUpdate('anime')

    // Мягкий fallback на старую схему: если какой-то новой колонки нет, пробуем сохранить базовые поля.
    if(!result.res.ok && /column|schema cache|PGRST204|does not exist/i.test(result.text || '')){
      const legacyPayload = stripEmpty({
        title: payload.title_ru || payload.title,
        original_title: payload.original_title,
        description: payload.description_ru || payload.description,
        poster_url: payload.poster_url,
        banner_url: payload.banner_url,
        status: payload.status,
        kind: payload.kind,
        year: payload.year,
        episodes: payload.episodes,
        rating: payload.rating,
        genres: payload.genres,
        studio: payload.studio,
        updated_at: payload.updated_at,
      })
      result = await tryUpdate('anime', legacyPayload)
    }

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
