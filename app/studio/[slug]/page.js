export const dynamic = 'force-dynamic'

import Link from 'next/link'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import { notFound } from 'next/navigation'
import { getAnimeList } from '@/lib/animeRepository'
import { slugifyRu } from '@/lib/routeSlugs'
import { buildPageMetadata, collectionPageJsonLd, jsonLd } from '@/lib/seo'
import { buildStudioSeoContent, faqJsonLd, webPageJsonLd } from '@/lib/seoContent'

function studioName(item){
  return item.studio && item.studio !== '—' ? String(item.studio).trim() : ''
}

function getStudioMatch(items, rawSlug){
  const target = slugifyRu(rawSlug)
  const studio = [...new Set(items.map(studioName).filter(Boolean))].find(s => slugifyRu(s) === target)
  const filtered = studio ? items.filter(a => studioName(a) === studio).sort((a,b)=>Number(b.score)-Number(a.score)) : []
  return { studio, filtered }
}

export async function generateMetadata({ params }){
  const { slug } = await params
  const anime = await getAnimeList({limit:1000})
  const { studio, filtered } = getStudioMatch(anime, slug)
  const path = `/studio/${encodeURIComponent(slug).replace(/%2F/g, '/')}`

  if(!studio || !filtered.length){
    return buildPageMetadata({
      title:'Студия не найдена — AIanime',
      description:'В этой студии пока нет тайтлов в каталоге AIanime.',
      path,
      index:false
    })
  }

  return buildPageMetadata({
    title: `${studio} — аниме студии смотреть онлайн | AIanime`,
    description: `Аниме студии ${studio}: список тайтлов, рейтинги, жанры, постеры и онлайн-просмотр на AIanime.`,
    path
  })
}

export default async function StudioPage({ params }){
  const { slug } = await params
  const anime = await getAnimeList({limit:1000})
  const { studio, filtered:items } = getStudioMatch(anime, slug)
  if(!studio || !items.length) notFound()

  const path = `/studio/${encodeURIComponent(slug).replace(/%2F/g, '/')}`
  const seo = buildStudioSeoContent(studio, items)
  const schemas = [
    collectionPageJsonLd({ name:`Аниме студии ${studio}`, description:`Список аниме студии ${studio} на AIanime.`, path, items:items.slice(0, 24).map(item => ({ title:item.title, slug:item.slug })) }),
    webPageJsonLd({ name:`Аниме студии ${studio}`, description:seo.lead, path }),
    faqJsonLd(seo.faq)
  ].filter(Boolean)

  return <main className="page seo-page"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(schemas)}} />
    <div className="page-head seo-head"><Link href="/studios">← Все студии</Link><h1>{studio}</h1><p>{items.length} тайтлов студии.</p></div>
    <details className="seo-fold-copy">
      <summary><span><b>{seo.summary}</b><small>{seo.lead}</small></span><em></em></summary>
      <div className="seo-fold-body">
        <p>{seo.intro}</p>
        <ul>{seo.points.map(point => <li key={point}>{point}</li>)}</ul>
        <div className="seo-fold-faq">{seo.faq.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
      </div>
    </details>

    <div className="poster-row seo-poster-row">
      {items.slice(0,20).map(a=><Link className="poster" href={`/anime/${a.slug}`} key={a.slug}><img loading="lazy" decoding="async" width="320" height="480" src={a.poster} alt={a.title ? `Постер аниме ${a.title}` : 'Постер аниме'}/><GlobalRatingBadge slug={a.slug} score={a.rating} count={a.siteRatingCount}/><div className="poster-info"><b>{a.title}</b><span>{a.meta}</span></div></Link>)}
    </div>
  </main>
}
