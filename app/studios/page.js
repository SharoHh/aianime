export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAnimeList } from '@/lib/animeRepository'

export const metadata = {
  title:'Студии аниме — Aianime',
  description:'Список аниме-студий и тайтлы каждой студии.'
}

function slugify(text){
  return String(text || 'unknown').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,'-').replace(/^-|-$/g,'') || 'unknown'
}

export default async function StudiosPage(){
  const anime = await getAnimeList({limit:1000})
  const map = new Map()
  anime.forEach(item => {
    const studio = item.studio && item.studio !== '—' ? item.studio : 'Неизвестная студия'
    map.set(studio, (map.get(studio) || 0) + 1)
  })
  const studios = [...map.entries()].sort((a,b)=>b[1]-a[1])

  return <main className="page seo-page">
    <div className="page-head seo-head"><Link href="/">← На главную</Link><h1>Студии</h1><p>Все студии из каталога и их тайтлы.</p></div>
    <section className="seo-grid studio-grid">
      {studios.map(([studio,count])=><Link className="seo-card studio-card" href={`/studio/${slugify(studio)}`} key={studio}>
        <span>{count} тайтлов</span>
        <b>{studio}</b>
        <p>Открыть аниме студии {studio}.</p>
        <em>Смотреть →</em>
      </Link>)}
    </section>
  </main>
}
