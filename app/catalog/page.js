export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Каталог аниме онлайн — смотреть на русском | AIanime',
  description: 'Большой каталог аниме онлайн на русском: поиск по тайтлам, жанрам, годам, статусу, рейтингу и быстрый переход к просмотру.',
  alternates: { canonical: '/catalog' },
  openGraph: { title: 'Каталог аниме онлайн — смотреть на русском | AIanime', description: 'Большой каталог аниме онлайн на русском: поиск по тайтлам, жанрам, годам, статусу, рейтингу и быстрый переход к просмотру.', url: '/catalog', type: 'website' }
}

import Link from 'next/link'
import { getAnimeList } from '@/lib/animeRepository'
import CatalogClient from './CatalogClient'
import { animeListJsonLd, jsonLd } from '@/lib/seo'

export default async function Catalog(){
  const anime = await getAnimeList({limit:720})
  return <main className="page catalog-page"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(animeListJsonLd(anime, '/catalog'))}} />
    <div className="page-head catalog-hero-head"><Link href="/">← На главную</Link><h1>Каталог аниме</h1><p>Удобная база тайтлов: фильтры, быстрый поиск, крупные постеры и аккуратная сетка без перегруза.</p></div>
    <CatalogClient items={anime}/>
  </main>
}
