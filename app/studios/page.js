export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAnimeList } from '@/lib/animeRepository'
import { encodeSlug } from '@/lib/routeSlugs'
import { collectionPageJsonLd, jsonLd } from '@/lib/seo'

export const metadata = {
  title: 'Студии аниме — тайтлы по студиям | AIanime',
  description: 'Каталог аниме по студиям: список студий, количество тайтлов и страницы просмотра на AIanime.',
  alternates: { canonical: '/studios' },
  openGraph: { title: 'Студии аниме — тайтлы по студиям | AIanime', description: 'Каталог аниме по студиям: список студий, количество тайтлов и страницы просмотра на AIanime.', url: '/studios', type: 'website' }
}

function studioName(item){
  return item.studio && item.studio !== '—' ? item.studio : ''
}

export default async function StudiosPage(){
  const anime = await getAnimeList({limit:1000})
  const map = new Map()
  anime.forEach(item => {
    const studio = studioName(item)
    if(!studio) return
    map.set(studio, (map.get(studio) || 0) + 1)
  })
  const studios = [...map.entries()].sort((a,b)=>b[1]-a[1])

  return <main className="page seo-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(collectionPageJsonLd({
      name:'Студии аниме AIanime',
      description:'Каталог студий аниме и их тайтлов на AIanime.',
      path:'/studios',
      items:studios.slice(0, 50).map(([studio]) => ({ name:studio, url:`/studio/${encodeSlug(studio)}` }))
    }))}} />
    <div className="page-head seo-head"><Link href="/">← На главную</Link><h1>Студии</h1><p>Все студии из каталога и их тайтлы.</p></div>
    <section className="seo-grid studio-grid">
      {studios.map(([studio,count])=><Link className="seo-card studio-card" href={`/studio/${encodeSlug(studio)}`} key={studio}>
        <span>{count} тайтлов</span>
        <b>{studio}</b>
        <p>Открыть аниме студии {studio}.</p>
        <em>Смотреть →</em>
      </Link>)}
    </section>
  </main>
}
