export const revalidate = 120

import Link from 'next/link'
import { getAnimeList } from '@/lib/animeRepository'

export const metadata = {
  title:'Жанры аниме — Aianime',
  description:'Все жанры аниме: романтика, экшен, фэнтези, психология и другие подборки.'
}

import { encodeSlug } from '@/lib/routeSlugs'

export default async function GenresPage(){
  const anime = await getAnimeList({limit:1000})
  const map = new Map()
  anime.forEach(item => (item.genres || []).forEach(g => map.set(g, (map.get(g) || 0) + 1)))
  const genres = [...map.entries()].sort((a,b)=>b[1]-a[1])

  return <main className="page seo-page">
    <div className="page-head seo-head"><Link href="/">← На главную</Link><h1>Жанры аниме</h1><p>Быстрый вход в каталог по настроению, жанру и вайбу.</p></div>
    <section className="seo-grid genre-grid">
      {genres.map(([genre,count])=><Link className="seo-card genre-card" href={`/genre/${encodeSlug(genre)}`} key={genre}>
        <span>{count} тайтлов</span>
        <b>{genre}</b>
        <p>Открыть подборку аниме в жанре “{genre}”.</p>
        <em>Смотреть →</em>
      </Link>)}
    </section>
  </main>
}
