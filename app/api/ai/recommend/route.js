import { getAnimeList } from '@/lib/animeRepository'
import { recommendWithOpenAI } from '@/lib/openAiAnimeRecommend'

export async function POST(req){
  const body = await req.json().catch(() => ({}))
  const query = String(body.query || '')
  const baseSlug = body.baseSlug ? String(body.baseSlug) : null
  const limit = Math.min(Math.max(Number(body.limit || 10), 1), 24)
  const context = body.context && typeof body.context === 'object' ? body.context : null
  const list = await getAnimeList({ limit: 720 })
  const payload = await recommendWithOpenAI(list, query, { baseSlug, limit, context })
  const results = Array.isArray(payload.results) ? payload.results : []

  return Response.json({
    ok: true,
    query,
    baseSlug,
    source: payload.source,
    model: payload.model,
    summary: payload.summary,
    openai: payload.openai,
    count: results.length,
    results: results.map(item => ({
      slug: item.slug,
      title: item.title,
      originalTitle: item.originalTitle,
      poster: item.poster,
      rating: item.rating,
      year: item.year,
      episodes: item.episodes,
      status: item.status,
      kind: item.kind,
      genres: item.genres,
      match: item.match,
      reason: item.reason
    }))
  })
}
