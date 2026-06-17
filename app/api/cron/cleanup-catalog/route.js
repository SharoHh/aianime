import { verifyCronAccess, cronAuthError } from '@/lib/cronAuth'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { isBrokenCatalogSlug, isDecorativeLocalPoster, isPlaceholderPoster } from '@/lib/animeQuality'

function parseBool(value){
  return ['1','true','yes','y'].includes(String(value || '').toLowerCase())
}

function clean(value){
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function rowHasBadPoster(row = {}){
  return isDecorativeLocalPoster(row.poster_url) || isDecorativeLocalPoster(row.banner_url) || isPlaceholderPoster(row.poster_url || row.banner_url)
}

async function readRows(){
  const select = 'id,slug,title,title_ru,original_title,description,description_ru,poster_url,banner_url,kind,year,updated_at'
  const res = await supabaseRequest(`anime?select=${encodeURIComponent(select)}&limit=1200`, { method:'GET', timeout:16000 })
  const text = await res.text().catch(() => '')
  let rows = []
  try{ rows = text ? JSON.parse(text) : [] }catch{}
  if(!res.ok) throw new Error(`Supabase select cleanup failed: ${res.status} ${text}`)
  return Array.isArray(rows) ? rows : []
}

async function deleteCatalogTitleRows(rows = []){
  const broken = rows.filter(row => isBrokenCatalogSlug(row.slug))
  if(!broken.length) return { deleted:0, sample:[] }

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

  return { deleted:Array.isArray(deleted) ? deleted.length : broken.length, sample:broken.slice(0,30) }
}

async function nullBadPosters(rows = []){
  const targets = rows
    .filter(row => !isBrokenCatalogSlug(row.slug) && rowHasBadPoster(row))
    .slice(0, 160)
  let saved = 0
  const failed = []
  for(const row of targets){
    const slug = clean(row.slug)
    if(!slug) continue
    const res = await supabaseRequest(`anime?slug=eq.${encodeURIComponent(slug)}`, {
      method:'PATCH',
      headers:{ 'Content-Type':'application/json', Prefer:'return=minimal' },
      body: JSON.stringify({ poster_url:null, banner_url:null, updated_at:new Date().toISOString() }),
      timeout:12000,
    })
    const text = await res.text().catch(() => '')
    if(res.ok) saved += 1
    else failed.push({ slug, error:`${res.status} ${text}` })
  }
  return { targets:targets.length, saved, failed:failed.slice(0,20), sample:targets.slice(0,30) }
}

function sampleRow(row){
  return {
    slug:row.slug,
    title:row.title_ru || row.title || row.original_title || '',
    kind:row.kind || '',
    year:row.year || null,
    posterUrl:row.poster_url || '',
    bannerUrl:row.banner_url || ''
  }
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
    const brokenSlugRows = rows.filter(row => isBrokenCatalogSlug(row.slug))
    const badPosterRows = rows.filter(row => !isBrokenCatalogSlug(row.slug) && rowHasBadPoster(row))

    if(!apply){
      return Response.json({
        ok:true,
        source:'cleanup-catalog',
        dryRun:true,
        found:brokenSlugRows.length + badPosterRows.length,
        brokenSlugCount:brokenSlugRows.length,
        badPosterCount:badPosterRows.length,
        brokenSlugSample:brokenSlugRows.slice(0,30).map(sampleRow),
        badPosterSample:badPosterRows.slice(0,50).map(sampleRow),
        hint:'Запусти apply=1: catalog-title-* удалятся, а локальные /posters/*.svg будут сброшены в null и исчезнут из каталога до enrichment.',
        auth:auth.mode,
        startedAt,
        finishedAt:new Date().toISOString(),
      })
    }

    const deleted = await deleteCatalogTitleRows(rows)
    const nulled = await nullBadPosters(rows)
    return Response.json({
      ok:true,
      source:'cleanup-catalog',
      dryRun:false,
      foundBefore:brokenSlugRows.length + badPosterRows.length,
      brokenSlugCount:brokenSlugRows.length,
      badPosterCount:badPosterRows.length,
      deletedCatalogTitle:deleted.deleted,
      nulledBadPosters:nulled.saved,
      nulledFailed:nulled.failed,
      deletedSample:deleted.sample.map(sampleRow),
      nulledSample:nulled.sample.map(sampleRow),
      auth:auth.mode,
      startedAt,
      finishedAt:new Date().toISOString(),
    })
  }catch(error){
    return Response.json({ ok:false, source:'cleanup-catalog', error:error?.message || String(error), startedAt, finishedAt:new Date().toISOString() }, { status:200 })
  }
}
