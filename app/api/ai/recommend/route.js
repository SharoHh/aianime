import { getAnimeList } from '@/lib/animeRepository'
import { recommendAnime } from '@/lib/aiAnime'

export async function POST(req){
  const body = await req.json().catch(() => ({}))
  const query = String(body.query || '')
  const baseSlug = body.baseSlug ? String(body.baseSlug) : null
  const limit = Math.min(Math.max(Number(body.limit || 10), 1), 24)
  const list = await getAnimeList({ limit: 1200 })
  const results = recommendAnime(list, query, { baseSlug, limit })

  return Response.json({
    ok: true,
    query,
    baseSlug,
    count: results.length,
    results: results.map(item => ({
      slug: item.slug,
      title: item.title,
      originalTitle: item.originalTitle,
      poster: item.poster,
      rating: item.rating,
      year: item.year,
      status: item.status,
      genres: item.genres,
      match: item.match,
      reason: item.reason
    }))
  })
}
