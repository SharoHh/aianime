export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAnimeList } from '@/lib/animeRepository'
import CatalogClient from './CatalogClient'

export default async function Catalog(){
  const anime = await getAnimeList({limit:1000})
  return <main className="page catalog-page">
    <div className="page-head catalog-hero-head"><Link href="/">← На главную</Link><h1>Каталог аниме</h1><p>Удобная база тайтлов: фильтры, быстрый поиск, крупные постеры и аккуратная сетка без перегруза.</p></div>
    <CatalogClient items={anime}/>
  </main>
}
