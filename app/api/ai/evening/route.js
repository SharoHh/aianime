import { getAnimeList } from '@/lib/animeRepository'
import { recommendAnime } from '@/lib/aiAnime'

export async function GET(){
  const list = await getAnimeList({ limit: 720 })
  const results = recommendAnime(list, 'что посмотреть вечером уютное интересное не слишком длинное', { preferCompleted: true, limit: 10 })
  return Response.json({
    ok: true,
    results: results.map(item => ({ slug: item.slug, title: item.title, poster: item.poster, rating: item.rating, match: item.match, reason: item.reason }))
  }, { headers:{ 'Cache-Control':'public, s-maxage=900, stale-while-revalidate=3600' } })
}
