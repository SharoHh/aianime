import { getAnimeList } from '@/lib/animeRepository'
import { recommendAnime } from '@/lib/aiAnime'

export async function GET(req){
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug') || ''
  const list = await getAnimeList({ limit: 1200 })
  const base = list.find(item => item.slug === slug)
  if(!base) return Response.json({ ok: false, error: 'Anime not found', results: [] }, { status: 404 })

  const results = recommendAnime(list, `похожие на ${base.title}`, { baseAnime: base, limit: 10 })
  return Response.json({
    ok: true,
    base: { slug: base.slug, title: base.title },
    results: results.map(item => ({ slug: item.slug, title: item.title, poster: item.poster, rating: item.rating, match: item.match, reason: item.reason }))
  })
}
