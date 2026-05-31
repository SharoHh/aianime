export const dynamic = 'force-dynamic'

import Link from 'next/link'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import { notFound } from 'next/navigation'
import { getAnimeList } from '@/lib/animeRepository'
import { buildPageMetadata, collectionPageJsonLd, jsonLd } from '@/lib/seo'

function slugify(text){
  return String(text || 'unknown').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,'-').replace(/^-|-$/g,'') || 'unknown'
}
function studioName(item){
  return item.studio && item.studio !== '—' ? item.studio : 'Неизвестная студия'
}

export async function generateMetadata({ params }){
  const { slug } = await params
  const anime = await getAnimeList({limit:1000})
  const studio = [...new Set(anime.map(studioName))].find(s => slugify(s) === slug)
  return buildPageMetadata({
    title: studio ? `${studio} — аниме студии смотреть онлайн | AIanime` : 'Студия аниме — AIanime',
    description: studio ? `Аниме студии ${studio}: список тайтлов, рейтинги, жанры, постеры и онлайн-просмотр на AIanime.` : 'Страница студии аниме на AIanime.',
    path:`/studio/${encodeURIComponent(slug).replace(/%2F/g, '/')}`
  })
}

export default async function StudioPage({ params }){
  const { slug } = await params
  const anime = await getAnimeList({limit:1000})
  const studio = [...new Set(anime.map(studioName))].find(s => slugify(s) === slug)
  if(!studio) notFound()
  const items = anime.filter(a => studioName(a) === studio).sort((a,b)=>Number(b.score)-Number(a.score))

  return <main className="page seo-page"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(collectionPageJsonLd({ name:`Аниме студии ${studio}`, description:`Список аниме студии ${studio} на AIanime.`, path:`/studio/${encodeURIComponent(slug).replace(/%2F/g, '/')}`, items:items.slice(0, 24).map(item => ({ title:item.title, slug:item.slug })) }))}} />
    <div className="page-head seo-head"><Link href="/studios">← Все студии</Link><h1>{studio}</h1><p>{items.length} тайтлов студии.</p></div>
    <div className="poster-row seo-poster-row">
      {items.slice(0,20).map(a=><Link className="poster" href={`/anime/${a.slug}`} key={a.slug}><img loading="lazy" decoding="async" src={a.poster}/><GlobalRatingBadge slug={a.slug} score={a.rating} count={a.siteRatingCount}/><div className="poster-info"><b>{a.title}</b><span>{a.meta}</span></div></Link>)}
    </div>
  </main>
}
