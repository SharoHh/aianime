import { NextResponse } from 'next/server'
import { getAnimeList } from '@/lib/animeRepository'

export async function POST(request){
  try{
    const body = await request.json()
    const historySlugs = new Set((body.history || []).map(x => x.slug))
    const favoriteSlugs = new Set((body.favorites || []).map(x => x.slug))
    const ratings = body.ratings || {}
    const anime = await getAnimeList({ limit: 1000 })

    const watched = anime.filter(item => historySlugs.has(item.slug) || favoriteSlugs.has(item.slug))
    const genreScore = new Map()

    for(const item of watched){
      const weight = favoriteSlugs.has(item.slug) ? 3 : 1
      for(const genre of item.genres || []) genreScore.set(genre, (genreScore.get(genre) || 0) + weight)
    }

    for(const [slug,value] of Object.entries(ratings)){
      const item = anime.find(x => x.slug === slug)
      if(!item) continue
      for(const genre of item.genres || []) genreScore.set(genre, (genreScore.get(genre) || 0) + Number(value))
    }

    const results = anime
      .filter(item => !historySlugs.has(item.slug))
      .map(item => {
        const genreMatch = (item.genres || []).reduce((sum,g)=>sum + (genreScore.get(g) || 0), 0)
        const score = genreMatch * 10 + Number(item.score || 0) * 4
        return {
          slug:item.slug,
          title:item.title,
          poster:item.poster,
          rating:item.rating,
          match: Math.min(99, Math.max(60, Math.round(score || Number(item.score || 0) * 10))),
          reason: genreMatch ? `Совпадает с твоими любимыми жанрами: ${(item.genres || []).slice(0,3).join(', ')}` : 'Подходит как популярный тайтл для старта.',
          score
        }
      })
      .sort((a,b)=>b.score-a.score)
      .slice(0,12)

    return NextResponse.json({ ok:true, results })
  }catch(error){
    return NextResponse.json({ ok:false, error:error?.message || 'Unknown error', results:[] }, { status:200 })
  }
}
