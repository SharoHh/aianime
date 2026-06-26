import { NextResponse } from 'next/server'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { cleanPublicText, translateGenres } from '@/lib/ruContent'
import { adminAnimeStats, matchesAdminFilter, normalizeAdminAnime, cleanAdminText } from '@/lib/adminQuality'
import { makeAnimeRestriction } from '@/lib/contentRestrictions'
import { invalidateAnimeRepositoryCache } from '@/lib/animeRepository'
import { invalidateScheduleCache } from '@/lib/scheduleData'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function json(data, status = 200){
  return NextResponse.json(data, {
    status,
    headers:{ 'Cache-Control':'no-store, max-age=0', 'X-Robots-Tag':'noindex, nofollow' }
  })
}

function cleanString(value){
  if(value === undefined) return undefined
  if(value === null) return null
  const text = String(value).trim()
  return text || null
}

function cleanContent(value){
  if(value === undefined) return undefined
  const text = cleanString(value)
  if(!text) return null
  return cleanPublicText(text) || null
}

function cleanUrl(value){
  if(value === undefined) return undefined
  const text = cleanString(value)
  if(!text) return null
  if(text.startsWith('/api/image?')){
    try{
      const parsed = new URL(text, 'https://aianime.local')
      return parsed.searchParams.get('url') || text
    }catch{ return text }
  }
  return text
}

function cleanNumber(value){
  if(value === undefined) return undefined
  if(value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeGenres(value){
  if(value === undefined) return undefined
  const raw = Array.isArray(value)
    ? value.map(item => cleanAdminText(item)).filter(Boolean)
    : String(value || '').split(',').map(item => cleanAdminText(item)).filter(Boolean)
  return translateGenres(raw)
}

function hasOwn(body, ...keys){
  return keys.some(key => Object.prototype.hasOwnProperty.call(body, key))
}

function normalizePatch(body){
  const payload = { updated_at:new Date().toISOString() }
  if(hasOwn(body, 'titleRu', 'title_ru')) payload.title_ru = cleanContent(body.titleRu ?? body.title_ru)
  if(hasOwn(body, 'title', 'titleEnglish')) payload.title = cleanContent(body.title ?? body.titleEnglish)
  if(hasOwn(body, 'originalTitle', 'original_title')) payload.original_title = cleanContent(body.originalTitle ?? body.original_title)
  if(hasOwn(body, 'otherTitle', 'other_title')) payload.other_title = cleanContent(body.otherTitle ?? body.other_title)
  if(hasOwn(body, 'descriptionRu', 'description_ru')) payload.description_ru = cleanContent(body.descriptionRu ?? body.description_ru)
  if(hasOwn(body, 'description')) payload.description = cleanContent(body.description)
  if(hasOwn(body, 'posterUrl', 'poster_url')) payload.poster_url = cleanUrl(body.posterUrl ?? body.poster_url)
  if(hasOwn(body, 'bannerUrl', 'banner_url')) payload.banner_url = cleanUrl(body.bannerUrl ?? body.banner_url)
  if(hasOwn(body, 'status')) payload.status = cleanString(body.status)
  if(hasOwn(body, 'kind')) payload.kind = cleanString(body.kind)
  if(hasOwn(body, 'year')) payload.year = cleanNumber(body.year)
  if(hasOwn(body, 'episodes')) payload.episodes = cleanNumber(body.episodes)
  if(hasOwn(body, 'rating')) payload.rating = cleanNumber(body.rating)
  if(hasOwn(body, 'studio')) payload.studio = cleanString(body.studio)
  if(hasOwn(body, 'genres')) payload.genres = normalizeGenres(body.genres)
  return payload
}

function stripForLegacy(payload){
  const allowed = new Set(['raw','title','title_ru','original_title','other_title','description','description_ru','poster_url','banner_url','status','kind','year','episodes','rating','genres','studio','updated_at'])
  const next = {}
  for(const [key,value] of Object.entries(payload)){
    if(allowed.has(key)) next[key] = value
  }
  return next
}

async function readCurrentRow(filter){
  const res = await supabaseRequest(`anime?select=id,slug,status,raw&${filter}&limit=1`, { method:'GET', timeout:10000 })
  const text = await res.text()
  let rows = []
  try{ rows = text ? JSON.parse(text) : [] }catch{}
  if(!res.ok) throw new Error(text || `Supabase current row read failed ${res.status}`)
  return Array.isArray(rows) ? rows[0] || null : null
}

function boolValue(value){
  if(value === true || value === 1) return true
  if(value === false || value === 0 || value === null) return false
  return ['1','true','yes','on','blocked','restricted'].includes(String(value || '').trim().toLowerCase())
}

function restrictionWasSubmitted(body = {}){
  return hasOwn(body, 'restricted', 'restrictionBlocked', 'restrictionMessage', 'restrictionReason', 'restrictionRegion')
}

async function readRows(){
  const res = await supabaseRequest('anime?select=*&order=updated_at.desc.nullslast&limit=1400', { method:'GET', timeout:15000 })
  const text = await res.text()
  let data = []
  try{ data = text ? JSON.parse(text) : [] }catch{}
  if(!res.ok) throw new Error(text || `Supabase read failed ${res.status}`)
  return Array.isArray(data) ? data : []
}

export async function GET(request){
  try{
    if(!hasSupabase()) return json({ ok:false, error:'Supabase env is not configured' }, 400)
    const { searchParams } = new URL(request.url)
    const q = cleanAdminText(searchParams.get('q')).toLowerCase()
    const filter = cleanAdminText(searchParams.get('filter') || 'all') || 'all'
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 120), 1), 500)

    const rows = await readRows()
    const normalized = rows.map(normalizeAdminAnime)
    const stats = adminAnimeStats(normalized)
    const items = normalized.filter(item => {
      if(!matchesAdminFilter(item, filter)) return false
      if(!q) return true
      const hay = `${item.slug} ${item.title} ${item.titleRu} ${item.originalTitle} ${item.otherTitle} ${item.genres.join(' ')}`.toLowerCase()
      return hay.includes(q)
    })

    return json({ ok:true, adminVersion:'v247', filter, q, stats, total:items.length, items:items.slice(0, limit) })
  }catch(error){
    return json({ ok:false, error:error?.message || 'Unknown admin anime error' }, 500)
  }
}

export async function PATCH(request){
  try{
    if(!hasSupabase()) return json({ ok:false, error:'Supabase env is not configured' }, 400)
    const body = await request.json()
    const slug = cleanAdminText(body.slug)
    const id = body.id !== undefined && body.id !== null && body.id !== '' ? Number(body.id) : null
    if(!slug && !id) return json({ ok:false, error:'slug or id is required' }, 400)

    const payload = normalizePatch(body)
    const filter = id ? `id=eq.${encodeURIComponent(id)}` : `slug=eq.${encodeURIComponent(slug)}`

    if(restrictionWasSubmitted(body)){
      const current = await readCurrentRow(filter)
      if(!current) return json({ ok:false, error:'Anime row not found' }, 404)
      const currentRaw = current.raw && typeof current.raw === 'object' && !Array.isArray(current.raw) ? current.raw : {}
      const existing = currentRaw.aianime_restriction && typeof currentRaw.aianime_restriction === 'object' ? currentRaw.aianime_restriction : {}
      const blocked = boolValue(body.restricted ?? body.restrictionBlocked)
      const submittedStatus = cleanString(body.status)
      const originalStatus = cleanString(existing.original_status)
        || (current.status && current.status !== 'restricted_ru' ? current.status : null)
        || (submittedStatus && submittedStatus !== 'restricted_ru' ? submittedStatus : null)
        || 'completed'
      payload.status = blocked ? 'restricted_ru' : originalStatus
      payload.raw = {
        ...currentRaw,
        aianime_restriction: makeAnimeRestriction({
          blocked,
          message: body.restrictionMessage ?? existing.message,
          reason: body.restrictionReason ?? existing.reason,
          region: body.restrictionRegion ?? existing.region ?? 'RU',
          originalStatus,
        })
      }
    }

    const run = async (data) => {
      const res = await supabaseRequest(`anime?${filter}&select=*`, {
        method:'PATCH',
        headers:{ 'Content-Type':'application/json', Prefer:'return=representation' },
        body: JSON.stringify(data),
        timeout:15000,
      })
      const text = await res.text()
      let parsed = null
      try{ parsed = text ? JSON.parse(text) : null }catch{}
      return { res, text, parsed }
    }

    let result = await run(payload)
    if(!result.res.ok && /column|schema cache|PGRST204|does not exist/i.test(result.text || '')){
      result = await run(stripForLegacy(payload))
    }
    if(!result.res.ok) return json({ ok:false, error:`Supabase update failed: ${result.res.status} ${result.text}` }, 500)

    const row = Array.isArray(result.parsed) ? result.parsed[0] : result.parsed
    const changedSlug = row?.slug || slug
    invalidateAnimeRepositoryCache(changedSlug)
    invalidateScheduleCache()
    try{
      revalidatePath('/')
      revalidatePath('/catalog')
      revalidatePath('/schedule')
      if(changedSlug) revalidatePath(`/anime/${changedSlug}`)
    }catch{}
    return json({ ok:true, adminVersion:'v247', item:normalizeAdminAnime(row || {}) })
  }catch(error){
    return json({ ok:false, error:error?.message || 'Unknown admin save error' }, 500)
  }
}
