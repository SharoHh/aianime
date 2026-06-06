export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAnimeList } from '@/lib/animeRepository'
import { encodeSlug } from '@/lib/routeSlugs'
import { collectionPageJsonLd, jsonLd } from '@/lib/seo'

export const metadata = {
  title: 'Жанры аниме — каталог по жанрам | AIanime',
  description: 'Все жанры аниме на AIanime: экшен, романтика, фэнтези, драма, комедия, повседневность, психология и другие подборки.',
  alternates: { canonical: '/genres' },
  openGraph: { title: 'Жанры аниме — каталог по жанрам | AIanime', description: 'Все жанры аниме на AIanime: экшен, романтика, фэнтези, драма, комедия, повседневность, психология и другие подборки.', url: '/genres', type: 'website' }
}

export default async function GenresPage(){
  const anime = await getAnimeList({limit:1000})
  const map = new Map()
  anime.forEach(item => (item.genres || []).forEach(g => map.set(g, (map.get(g) || 0) + 1)))
  const genres = [...map.entries()].sort((a,b)=>b[1]-a[1])

  return <main className="page seo-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(collectionPageJsonLd({
      name:'Жанры аниме AIanime',
      description:'Все жанры аниме на AIanime с переходом к подборкам по жанрам.',
      path:'/genres',
      items:genres.slice(0, 50).map(([genre]) => ({ name:genre, url:`/genre/${encodeSlug(genre)}` }))
    }))}} />
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
