import { NextResponse } from 'next/server'
import { searchJikanAnimeVariants, normalizeJikanAnime, scoreJikanSearchCandidate } from '@/lib/jikan'
import { findExistingAnimeByMalIds } from '@/lib/animeDbImport'

function json(data, status = 200){
  return NextResponse.json(data, {
    status,
    headers:{ 'Cache-Control':'no-store, max-age=0', 'X-Robots-Tag':'noindex, nofollow' }
  })
}

function compactCandidate(item, query){
  const normalized = normalizeJikanAnime(item)
  const relevance = scoreJikanSearchCandidate(item, query)
  return {
    malId: item?.mal_id || normalized.mal_id,
    slug: normalized.slug,
    title: item?.title_english || item?.title || normalized.title,
    originalTitle: item?.title || item?.title_japanese || normalized.original_title,
    type: item?.type || normalized.kind,
    kind: normalized.kind,
    status: normalized.status,
    year: normalized.year,
    episodes: normalized.episodes,
    score: item?.score || normalized.rating,
    posterUrl: normalized.poster_url,
    sourceQuery: item?.__aianime_search_query || '',
    relevanceScore: relevance.score,
    matchedTitle: relevance.matchedTitle,
  }
}

export async function GET(request){
  const { searchParams } = new URL(request.url)
  const q = String(searchParams.get('q') || '').trim()
  const type = String(searchParams.get('type') || '').trim()
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 10), 1), 20)

  if(!q || q.length < 2){
    return json({ ok:false, error:'q is required' }, 400)
  }

  try{
    const search = await searchJikanAnimeVariants({ q, type, limit, order:'title' })
    const candidates = search.data.map(item => compactCandidate(item, q)).sort((a, b) => Number(b.relevanceScore || 0) - Number(a.relevanceScore || 0))
    const existing = await findExistingAnimeByMalIds(candidates.map(item => item.malId))
    const withState = candidates.map(item => ({
      ...item,
      exists: existing.has(Number(item.malId)),
      existing: existing.get(Number(item.malId)) || null,
    }))

    return json({ ok:true, q, type:type || null, variants:search.variants, attempts:search.attempts, candidates:withState })
  }catch(error){
    return json({ ok:false, error:error?.message || 'Jikan search failed' }, 500)
  }
}
