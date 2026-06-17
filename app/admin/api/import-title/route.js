import { NextResponse } from 'next/server'
import { fetchJikanAnimeDetails, searchJikanAnimeVariants, normalizeJikanAnime, getJikanSearchQueryVariants } from '@/lib/jikan'
import { saveAnimeRowsToDb } from '@/lib/animeDbImport'

function json(data, status = 200){
  return NextResponse.json(data, {
    status,
    headers:{ 'Cache-Control':'no-store, max-age=0', 'X-Robots-Tag':'noindex, nofollow' }
  })
}

function hasCyrillic(value){
  return /[А-Яа-яЁё]/.test(String(value || ''))
}

function pickTitleRu(body){
  const explicit = String(body.titleRu || body.title_ru || '').trim()
  if(hasCyrillic(explicit)) return explicit
  const q = String(body.q || body.query || '').replace(/([а-яё])([A-Z])/giu, '$1 $2').trim()
  const cyrillic = q.replace(/[^А-Яа-яЁё0-9\s:'’.,!?#&+\-]/g, ' ').replace(/\s+/g, ' ').trim()
  return hasCyrillic(cyrillic) ? cyrillic : ''
}

async function resolveItem(body){
  const malId = Number(body.malId || body.mal_id || 0)
  if(Number.isFinite(malId) && malId > 0){
    const details = await fetchJikanAnimeDetails(malId)
    if(!details) throw new Error('Jikan details returned empty item')
    return { item: details, resolvedBy:'mal_id', attempts:[{ malId }] }
  }

  const q = String(body.q || body.query || '').trim()
  if(!q) throw new Error('malId or q is required')
  const type = String(body.type || '').trim()
  const search = await searchJikanAnimeVariants({ q, type, limit:8 })
  const item = search.data[0]
  if(!item) throw new Error(`Jikan did not find anime for query: ${q}`)
  return { item, resolvedBy:'query', attempts:search.attempts, variants:getJikanSearchQueryVariants(q) }
}

export async function POST(request){
  try{
    const body = await request.json()
    const titleRu = pickTitleRu(body)
    const resolved = await resolveItem(body)
    let details = resolved.item

    // Search results are enough for cards, but full details give better synopsis/studio/genres.
    if(resolved.item?.mal_id && resolved.resolvedBy !== 'mal_id'){
      try{ details = await fetchJikanAnimeDetails(resolved.item.mal_id) || resolved.item }catch{}
    }

    const normalized = normalizeJikanAnime(details)
    if(titleRu) normalized.title_ru = titleRu
    const database = await saveAnimeRowsToDb([normalized], { source:'jikan-manual', titleRu })
    if(!database.ok){
      return json({ ok:false, error:database.error || database.reason || 'Supabase save failed', resolved }, 500)
    }

    return json({
      ok:true,
      imported:true,
      resolvedBy:resolved.resolvedBy,
      attempts:resolved.attempts,
      item:{
        slug: normalized.slug,
        malId: normalized.mal_id,
        title: normalized.title,
        titleRu: titleRu || normalized.title_ru || '',
        originalTitle: normalized.original_title,
        kind: normalized.kind,
        year: normalized.year,
        episodes: normalized.episodes,
        posterUrl: normalized.poster_url,
      },
      database
    })
  }catch(error){
    return json({ ok:false, error:error?.message || 'Import failed' }, 500)
  }
}
