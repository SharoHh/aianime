import { getAnimeList } from '@/lib/animeRepository'
import { filterAndSortAnime } from '@/lib/searchRelevance'
import { isPublicReadyAnimeItem } from '@/lib/animeQuality'

export const dynamic = 'force-dynamic'

function clean(value, limit = 140){
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function compact(item = {}){
  return {
    slug:clean(item.slug, 220),
    title:clean(item.title || item.displayTitle || item.titleRu || 'Без названия', 120),
    titleRu:clean(item.titleRu || item.title_ru || '', 120),
    originalTitle:clean(item.originalTitle || item.original_title || '', 140),
    englishTitle:clean(item.englishTitle || '', 140),
    poster:item.poster || item.poster_url || '',
    year:item.year || null,
    meta:clean(item.meta || item.kind || '', 60),
    kind:clean(item.kind || '', 40),
    status:clean(item.status || '', 40),
    rating:item.rating || '—',
    score:Number(item.score || 0) || 0,
    popularity:Number(item.popularity || 0) || 0,
    genres:Array.isArray(item.genres) ? item.genres.filter(Boolean).slice(0, 6) : [],
    description:clean(item.description || item.descriptionRu || '', 220),
    studio:clean(item.studio || '', 80),
    hasRealPoster:item.hasRealPoster !== false,
    kodikId:item.kodikId || item.kodik_id || null,
    kodikLink:item.kodikLink || item.kodik_link || null,
    translationTitle:clean(item.translationTitle || item.translation_title || '', 80)
  }
}

export async function GET(request){
  try{
    const { searchParams } = new URL(request.url)
    const query = clean(searchParams.get('q'), 180)
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 8), 1), 12)
    const list = await getAnimeList({ limit:1200 })
    const safe = (Array.isArray(list) ? list : []).filter(isPublicReadyAnimeItem)
    const sorted = filterAndSortAnime(safe, query, {}, query ? 'relevant' : 'popular')
    const items = sorted.slice(0, limit).map(compact)

    return Response.json({ ok:true, query, count:items.length, items }, {
      headers:{ 'Cache-Control':query ? 'private, no-store' : 'public, s-maxage=60, stale-while-revalidate=300' }
    })
  }catch(error){
    console.error('AIanime public search failed:', error?.message || error)
    return Response.json({ ok:false, error:'Поиск временно недоступен', items:[] }, { status:500 })
  }
}
