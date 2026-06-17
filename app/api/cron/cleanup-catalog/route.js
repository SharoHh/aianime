import { verifyCronAccess, cronAuthError } from '@/lib/cronAuth'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'

function parseBool(value){
  return ['1','true','yes','y'].includes(String(value || '').toLowerCase())
}

async function readRows(){
  const select = 'id,slug,title,title_ru,original_title,description,description_ru,poster_url,kind,year,updated_at'
  const res = await supabaseRequest(`anime?select=${encodeURIComponent(select)}&slug=like.catalog-title-*&limit=500`, { method:'GET', timeout:12000 })
  const text = await res.text().catch(() => '')
  let rows = []
  try{ rows = text ? JSON.parse(text) : [] }catch{}
  if(!res.ok) throw new Error(`Supabase select cleanup failed: ${res.status} ${text}`)
  return Array.isArray(rows) ? rows : []
}

async function deleteRows(){
  const episodesRes = await supabaseRequest('anime_episodes?anime_slug=like.catalog-title-*', {
    method:'DELETE',
    headers:{ Prefer:'return=minimal' },
    timeout:12000,
  })
  const episodesText = await episodesRes.text().catch(() => '')
  if(!episodesRes.ok) throw new Error(`Supabase episodes cleanup failed: ${episodesRes.status} ${episodesText}`)

  const animeRes = await supabaseRequest('anime?slug=like.catalog-title-*', {
    method:'DELETE',
    headers:{ Prefer:'return=representation' },
    timeout:12000,
  })
  const animeText = await animeRes.text().catch(() => '')
  let deleted = []
  try{ deleted = animeText ? JSON.parse(animeText) : [] }catch{}
  if(!animeRes.ok) throw new Error(`Supabase anime cleanup failed: ${animeRes.status} ${animeText}`)

  return { deleted:Array.isArray(deleted) ? deleted : [], episodesStatus:episodesRes.status }
}

export async function GET(request){
  const auth = verifyCronAccess(request)
  if(!auth.ok) return cronAuthError(auth)
  const { searchParams } = new URL(request.url)
  const apply = parseBool(searchParams.get('apply'))
  const startedAt = new Date().toISOString()

  if(!hasSupabase()){
    return Response.json({ ok:false, source:'cleanup-catalog', error:'Supabase env is not configured', startedAt, finishedAt:new Date().toISOString() }, { status:200 })
  }

  try{
    const rows = await readRows()
    if(!apply){
      return Response.json({
        ok:true,
        source:'cleanup-catalog',
        dryRun:true,
        found:rows.length,
        sample:rows.slice(0, 30).map(row => ({ slug:row.slug, title:row.title_ru || row.title || row.original_title || '', kind:row.kind || '', year:row.year || null })),
        hint:'Запусти apply=1, чтобы удалить catalog-title-* мусорные строки и связанные anime_episodes.',
        auth:auth.mode,
        startedAt,
        finishedAt:new Date().toISOString(),
      })
    }

    const result = await deleteRows()
    return Response.json({
      ok:true,
      source:'cleanup-catalog',
      dryRun:false,
      foundBefore:rows.length,
      deleted:result.deleted.length,
      deletedSample:result.deleted.slice(0, 30).map(row => ({ slug:row.slug, title:row.title_ru || row.title || row.original_title || '' })),
      auth:auth.mode,
      startedAt,
      finishedAt:new Date().toISOString(),
    })
  }catch(error){
    return Response.json({ ok:false, source:'cleanup-catalog', error:error?.message || String(error), startedAt, finishedAt:new Date().toISOString() }, { status:200 })
  }
}
