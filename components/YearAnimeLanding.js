import Link from 'next/link'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import { getAnimeList } from '@/lib/animeRepository'
import { buildPageMetadata, collectionPageJsonLd, jsonLd } from '@/lib/seo'
import { buildYearSeoContent, faqJsonLd } from '@/lib/seoContent'

function safeYear(value){
  const year = Number(value)
  if(!Number.isFinite(year)) return null
  const current = new Date().getFullYear() + 1
  if(year < 1990 || year > current) return null
  return Math.floor(year)
}

function sortYearItems(items = []){
  return [...items].sort((a,b) => {
    const score = Number(b.score || b.rating || 0) - Number(a.score || a.rating || 0)
    if(score) return score
    return String(a.title || '').localeCompare(String(b.title || ''), 'ru')
  })
}

export async function generateYearMetadata(yearValue){
  const year = safeYear(yearValue) || new Date().getFullYear()
  const anime = await getAnimeList({ limit: 1000 })
  const items = anime.filter(item => Number(item.year || 0) === year)

  if(!items.length){
    return buildPageMetadata({
      title:`Аниме ${year} года — AIanime`,
      description:`Подборка аниме ${year} года пока формируется. Вернись в каталог AIanime или открой сезонные онгоинги.`,
      path:`/anime-${year}`,
      index:false
    })
  }

  return buildPageMetadata({
    title:`Аниме ${year} года смотреть онлайн — AIanime`,
    description:`${items.length} тайтлов ${year} года: новинки, онгоинги, рейтинги, жанры, постеры и просмотр онлайн на русском в AIanime.`,
    path:`/anime-${year}`
  })
}

function Poster({item}){
  return <Link className="poster" href={`/anime/${item.slug}`}>
    <img loading="lazy" decoding="async" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/>
    <GlobalRatingBadge slug={item.slug} score={item.rating} count={item.siteRatingCount}/>
    <div className="poster-info"><b>{item.title}</b><span>{item.meta}</span></div>
  </Link>
}

export default async function YearAnimeLanding({ year:yearValue }){
  const year = safeYear(yearValue) || new Date().getFullYear()
  const anime = await getAnimeList({ limit: 1000 })
  const items = sortYearItems(anime.filter(item => Number(item.year || 0) === year))
  const seo = buildYearSeoContent(year, items)
  const schemas = [
    collectionPageJsonLd({
      name:`Аниме ${year} года`,
      description:seo.lead,
      path:`/anime-${year}`,
      items:items.slice(0, 24).map(item => ({ title:item.title, slug:item.slug }))
    }),
    faqJsonLd(seo.faq)
  ].filter(Boolean)

  return <main className="page seo-page year-seo-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(schemas)}} />
    <div className="page-head seo-head">
      <Link href="/season">← К сезонному аниме</Link>
      <h1>Аниме {year} года</h1>
      <p>{items.length ? seo.lead : `Подборка аниме ${year} года пока формируется. Открой каталог или текущий сезон.`}</p>
    </div>

    <section className="seo-copy-card" aria-labelledby="year-seo-heading">
      <div>
        <h2 id="year-seo-heading">Новинки и тайтлы {year} года</h2>
        <p>{seo.intro}</p>
      </div>
      <ul>
        <li>Сравнивай тайтлы по рейтингу, жанрам, статусу и количеству серий.</li>
        <li>Открывай страницу тайтла, чтобы посмотреть описание, плеер и похожие аниме.</li>
        <li>Возвращайся к странице после обновлений каталога: список может пополняться.</li>
      </ul>
    </section>

    {items.length ? <div className="poster-row seo-poster-row">
      {items.slice(0, 40).map(item => <Poster item={item} key={item.slug}/>) }
    </div> : <section className="seo-empty-card">
      <h2>Пока нет тайтлов за {year} год</h2>
      <p>Каталог обновляется через синхронизацию. Можно перейти в общий каталог или открыть текущий сезон.</p>
      <div><Link href="/catalog">Каталог</Link><Link href="/season">Сезон</Link></div>
    </section>}

    <section className="seo-faq-card" aria-labelledby="year-faq-heading">
      <h2 id="year-faq-heading">Вопросы про аниме {year} года</h2>
      <div className="seo-faq-list">
        {seo.faq.map(item => <details key={item.question}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>)}
      </div>
    </section>
  </main>
}
