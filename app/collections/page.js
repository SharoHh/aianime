export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Подборки аниме по настроению и жанрам — AIanime',
  description: 'Готовые подборки аниме: романтика, приключения, уютные тайтлы, новинки, шедевры и AI-рекомендации под настроение.',
  alternates: { canonical: '/collections' },
  openGraph: { title: 'Подборки аниме по настроению и жанрам — AIanime', description: 'Готовые подборки аниме: романтика, приключения, уютные тайтлы, новинки, шедевры и AI-рекомендации под настроение.', url: '/collections', type: 'website' }
}

import Link from 'next/link'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import { collections } from '@/lib/data'
import { getAnimeList } from '@/lib/animeRepository'
import { collectionPageJsonLd, jsonLd } from '@/lib/seo'

const collectionRules = [
  { q:'эмоциональное тёплое аниме', filter:a => (a.genres || []).some(g => ['Драма','Романтика','Повседневность'].includes(g)) },
  { q:'приключения и экшен', filter:a => (a.genres || []).some(g => ['Приключения','Экшен','Фэнтези'].includes(g)) },
  { q:'лёгкое аниме на вечер', filter:a => (a.genres || []).some(g => ['Комедия','Повседневность','Романтика'].includes(g)) || Number(a.episodes || 0) <= 13 },
  { q:'популярные новинки', filter:a => Number(a.year || 0) >= 2024 },
  { q:'лучшие аниме по рейтингу', filter:a => Number(a.rating || a.score || 0) >= 8.6 },
]

function Poster({item}){
  return <Link href={`/anime/${item.slug}`} className="poster">
    <img loading="lazy" decoding="async" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/><GlobalRatingBadge slug={item.slug} score={item.rating} count={item.siteRatingCount}/><div className="poster-info"><b>{item.title}</b><span>{item.meta}</span></div>
  </Link>
}

export default async function CollectionsPage(){
  const anime = await getAnimeList({ limit: 1000 })
  const schemaItems = collections.map((c, i) => ({ name:c[0], url:`/ai?q=${encodeURIComponent((collectionRules[i] || collectionRules[0]).q)}` }))

  return <main className="page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(collectionPageJsonLd({
      name:'Подборки аниме AIanime',
      description:'Готовые подборки аниме по настроению, жанрам и AI-запросам.',
      path:'/collections',
      items:schemaItems
    }))}} />
    <div className="page-head"><Link href="/">← На главную</Link><h1>Подборки</h1><p>Живые подборки связаны с каталогом и AI-запросами. Открой подборку или сразу запусти AI-подбор.</p></div>
    {collections.map((c, i) => {
      const rule = collectionRules[i] || collectionRules[0]
      const items = anime.filter(rule.filter).slice(0,5)
      return <section key={c[0]}>
        <div className="section-title"><h2><span>{c[2]}</span>{c[0]}</h2><Link href={`/ai?q=${encodeURIComponent(rule.q)}`}>AI-подбор ›</Link></div>
        <div className="poster-row">{items.map(a => <Poster item={a} key={a.slug}/>)}</div>
      </section>
    })}
  </main>
}
