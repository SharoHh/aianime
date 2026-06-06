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
import { COLLECTION_SEO, collectionFaq, faqJsonLd, webPageJsonLd } from '@/lib/seoContent'

function Poster({item}){
  return <Link href={`/anime/${item.slug}`} className="poster">
    <img loading="lazy" decoding="async" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/><GlobalRatingBadge slug={item.slug} score={item.rating} count={item.siteRatingCount}/><div className="poster-info"><b>{item.title}</b><span>{item.meta}</span></div>
  </Link>
}

export default async function CollectionsPage(){
  const anime = await getAnimeList({ limit: 1000 })
  const faq = collectionFaq()
  const schemaItems = collections.map((c, i) => ({ name:c[0], url:`/ai?q=${encodeURIComponent((COLLECTION_SEO[i] || COLLECTION_SEO[0]).q)}` }))
  const schemas = [
    collectionPageJsonLd({
      name:'Подборки аниме AIanime',
      description:'Готовые подборки аниме по настроению, жанрам и AI-запросам.',
      path:'/collections',
      items:schemaItems
    }),
    webPageJsonLd({
      name:'Подборки аниме по настроению и жанрам',
      description:'Страница с готовыми подборками аниме на русском: уютные тайтлы, приключения, новинки, рейтинговые шедевры и AI-подбор под настроение.',
      path:'/collections'
    }),
    faqJsonLd(faq)
  ].filter(Boolean)

  return <main className="page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(schemas)}} />
    <div className="page-head"><Link href="/">← На главную</Link><h1>Подборки</h1><p>Живые подборки связаны с каталогом и AI-запросами. Открой подборку или сразу запусти AI-подбор.</p></div>

    <details className="seo-fold-copy collections-seo-fold">
      <summary><span><b>Как устроены подборки AIanime</b><small>Коротко о подборках по настроению, жанрам и рейтингу</small></span><em></em></summary>
      <div className="seo-fold-body">
        <p>Подборки помогают выбрать аниме без долгого поиска по всему каталогу: можно начать с настроения, жанра, свежих тайтлов или проверенных работ с высоким рейтингом.</p>
        <ul>
          <li>Для быстрого выбора открой подходящий блок и сравни карточки по жанрам, году и рейтингу.</li>
          <li>Для точного подбора нажми “AI-подбор” — можно описать настроение или любимые тайтлы.</li>
          <li>Состав подборок связан с каталогом и может обновляться после синхронизации данных.</li>
        </ul>
        <div className="seo-fold-faq">{faq.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
      </div>
    </details>

    {collections.map((c, i) => {
      const rule = COLLECTION_SEO[i] || COLLECTION_SEO[0]
      const items = anime.filter(rule.filter).slice(0,5)
      return <section key={c[0]}>
        <div className="section-title"><h2><span>{c[2]}</span>{c[0]}</h2><Link href={`/ai?q=${encodeURIComponent(rule.q)}`}>AI-подбор ›</Link></div>
        <p className="collection-seo-description">{rule.description}</p>
        <div className="poster-row">{items.map(a => <Poster item={a} key={a.slug}/>)}</div>
      </section>
    })}
  </main>
}
