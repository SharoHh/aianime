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
import { COLLECTION_SEO, collectionFaq, faqJsonLd } from '@/lib/seoContent'

function collectionRule(index){
  return COLLECTION_SEO[index] || COLLECTION_SEO[0]
}

function Poster({item}){
  return <Link href={`/anime/${item.slug}`} className="poster">
    <img loading="lazy" decoding="async" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/><GlobalRatingBadge slug={item.slug} score={item.rating} count={item.siteRatingCount}/><div className="poster-info"><b>{item.title}</b><span>{item.meta}</span></div>
  </Link>
}

export default async function CollectionsPage(){
  const anime = await getAnimeList({ limit: 1000 })
  const faq = collectionFaq()
  const schemaItems = collections.map((c, i) => ({ name:c[0], url:`/ai?q=${encodeURIComponent(collectionRule(i).q)}` }))
  const schemas = [
    collectionPageJsonLd({
      name:'Подборки аниме AIanime',
      description:'Готовые подборки аниме по настроению, жанрам и AI-запросам.',
      path:'/collections',
      items:schemaItems
    }),
    faqJsonLd(faq)
  ].filter(Boolean)

  return <main className="page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(schemas)}} />
    <div className="page-head"><Link href="/">← На главную</Link><h1>Подборки</h1><p>Живые подборки связаны с каталогом и AI-запросами. Открой подборку или сразу запусти AI-подбор.</p></div>

    <section className="seo-copy-card collections-seo-intro" aria-labelledby="collections-seo-heading">
      <div>
        <h2 id="collections-seo-heading">Аниме по настроению: быстрый выбор без долгого поиска</h2>
        <p>Подборки AIanime помогают выбрать тайтл не только по жанру, но и по состоянию: для отдыха, грустного вечера, приключений, новинок или рейтинговых хитов. Каждая группа собирается из текущего каталога, поэтому карточки остаются связаны с реальными страницами тайтлов, рейтингами, постерами и плеером.</p>
      </div>
      <ul>
        <li>Выбирай подборку по настроению, а не только по названию жанра.</li>
        <li>Открывай AI-подбор, если хочешь уточнить запрос под любимые тайтлы.</li>
        <li>После выбора переходи к похожим аниме на странице конкретного тайтла.</li>
      </ul>
    </section>

    {collections.map((c, i) => {
      const rule = collectionRule(i)
      const items = anime.filter(rule.filter).slice(0,5)
      return <section key={c[0]} className="collection-seo-section">
        <div className="section-title"><h2><span>{c[2]}</span>{c[0]}</h2><Link href={`/ai?q=${encodeURIComponent(rule.q)}`}>AI-подбор ›</Link></div>
        <p className="collection-seo-text">{rule.description}</p>
        <div className="poster-row">{items.map(a => <Poster item={a} key={a.slug}/>)}</div>
      </section>
    })}

    <section className="seo-faq-card" aria-labelledby="collections-faq-heading">
      <h2 id="collections-faq-heading">Вопросы о подборках</h2>
      <div className="seo-faq-list">
        {faq.map(item => <details key={item.question}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>)}
      </div>
    </section>
  </main>
}
