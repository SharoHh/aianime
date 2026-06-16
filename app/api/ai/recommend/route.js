import { getAnimeList } from '@/lib/animeRepository'
import { recommendWithOpenAI } from '@/lib/openAiAnimeRecommend'

const AI_CACHE_TTL_MS = Number(process.env.AI_RECOMMEND_CACHE_TTL_MS || 6 * 60 * 60 * 1000)
const AI_RESPONSE_CACHE = globalThis.__aianimeAiResponseCache || new Map()
globalThis.__aianimeAiResponseCache = AI_RESPONSE_CACHE

function makeCacheKey({ query, baseSlug, limit, context }){
  return JSON.stringify({
    query: String(query || '').trim().toLowerCase(),
    baseSlug: baseSlug || null,
    limit,
    context: context || null
  })
}

function getCached(key){
  const row = AI_RESPONSE_CACHE.get(key)
  if(!row) return null
  if(Date.now() - row.time > AI_CACHE_TTL_MS){
    AI_RESPONSE_CACHE.delete(key)
    return null
  }
  return row.payload
}

function setCached(key, payload){
  if(!payload || !['external-openai', 'external-gemini', 'openai', 'gemini'].includes(payload.source)) return
  AI_RESPONSE_CACHE.set(key, { time: Date.now(), payload })
  if(AI_RESPONSE_CACHE.size > 80){
    const first = AI_RESPONSE_CACHE.keys().next().value
    if(first) AI_RESPONSE_CACHE.delete(first)
  }
}

function responsePayload({ query, baseSlug, payload, cached = false }){
  const results = Array.isArray(payload.results) ? payload.results : []
  return {
    ok: true,
    query,
    baseSlug,
    source: payload.source,
    model: payload.model,
    summary: cached ? `${payload.summary || 'AI подобрал тайтлы по смыслу запроса.'}` : payload.summary,
    cached,
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
  }
}

export async function POST(req){
  const body = await req.json().catch(() => ({}))
  const query = String(body.query || '')
  const baseSlug = body.baseSlug ? String(body.baseSlug) : null
  const limit = Math.min(Math.max(Number(body.limit || 10), 1), 24)
  const context = body.context && typeof body.context === 'object' ? body.context : null
  const cacheKey = makeCacheKey({ query, baseSlug, limit, context })
  const cached = getCached(cacheKey)
  if(cached){
    return Response.json(responsePayload({ query, baseSlug, payload: cached, cached: true }))
  }

  const list = await getAnimeList({ limit: 1200 })
  const payload = await recommendWithOpenAI(list, query, { baseSlug, limit, context })
  setCached(cacheKey, payload)

  return Response.json(responsePayload({ query, baseSlug, payload }))
}
