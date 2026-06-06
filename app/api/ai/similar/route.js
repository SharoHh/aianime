import { getAnimeBySlugFromRepo, getAnimeList } from '@/lib/animeRepository'
import { recommendAnime } from '@/lib/aiAnime'

export async function GET(req){
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug') || ''
  const base = await getAnimeBySlugFromRepo(slug)
  if(!base) return Response.json({ ok: false, error: 'Anime not found', results: [] }, { status: 404 })

  const list = await getAnimeList({ limit: 720 })
  const results = recommendAnime(list, `похожие на ${base.title}`, { baseAnime: base, limit: 10 })
  return Response.json({
    ok: true,
    base: { slug: base.slug, title: base.title },
    results: results.map(item => ({ slug: item.slug, title: item.title, poster: item.poster, rating: item.rating, match: item.match, reason: item.reason }))
  }, { headers:{ 'Cache-Control':'public, s-maxage=900, stale-while-revalidate=3600' } })
}
