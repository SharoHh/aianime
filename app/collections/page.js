export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Подборки аниме по настроению и жанрам — AIanime',
  description: 'Живые подборки аниме без повторов: шедевры, сильные сюжеты, приключения, уютные тайтлы, короткие истории и свежие хиты.',
  alternates: { canonical: '/collections' },
  openGraph: {
    title: 'Подборки аниме по настроению и жанрам — AIanime',
    description: 'Живые подборки аниме без повторов: шедевры, сильные сюжеты, приключения, уютные тайтлы, короткие истории и свежие хиты.',
    url: '/collections',
    type: 'website'
  }
}

import Link from 'next/link'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import { getAnimeList } from '@/lib/animeRepository'
import { collectionPageJsonLd, jsonLd } from '@/lib/seo'
import { collectionFaq, faqJsonLd, webPageJsonLd } from '@/lib/seoContent'

const COLLECTIONS = [
  {
    title:'Шедевры',
    icon:'♕',
    q:'лучшие аниме всех времён',
    description:'Проверенные временем тайтлы с сильной репутацией, высоким внешним рейтингом и законченным впечатлением.',
    filter:item => qualityScore(item) >= 8.15,
    rank:item => qualityScore(item) * 100 + completedBonus(item) + movieBonus(item)
  },
  {
    title:'С чего начать',
    icon:'✦',
    q:'лучшее аниме для первого знакомства',
    description:'Понятные, яркие и легко увлекающие тайтлы — хороший вход в аниме без слишком узкой жанровой специфики.',
    filter:item => qualityScore(item) >= 7.5 && Number(item.episodes || 0) > 0,
    rank:item => qualityScore(item) * 90 + popularityScore(item) * 2 + compactBonus(item)
  },
  {
    title:'Сюжет, который затягивает',
    icon:'◈',
    q:'аниме с сильным сюжетом и интригой',
    description:'Триллеры, драмы, детективы и психологические истории, где хочется сразу включить следующую серию.',
    filter:item => hasAnyGenre(item, ['Драма','Триллер','Психология','Детектив','Мистика','Сверхъестественное']),
    rank:item => qualityScore(item) * 80 + genreHits(item, ['Триллер','Психология','Детектив','Мистика']) * 22 + popularityScore(item)
  },
  {
    title:'Большое приключение',
    icon:'🚀',
    q:'захватывающее приключенческое аниме',
    description:'Путешествия, большие миры, экшен, фэнтези и герои, за которыми интересно следовать до самого финала.',
    filter:item => hasAnyGenre(item, ['Приключения','Экшен','Фэнтези','Исэкай','Фантастика','Сёнен']),
    rank:item => qualityScore(item) * 75 + genreHits(item, ['Приключения','Экшен','Фэнтези']) * 20 + popularityScore(item)
  },
  {
    title:'Уютный вечер',
    icon:'☕',
    q:'уютное лёгкое аниме на вечер',
    description:'Романтика, комедия, повседневность и добрые истории без тяжёлого напряжения — чтобы спокойно отдохнуть.',
    filter:item => hasAnyGenre(item, ['Комедия','Романтика','Повседневность','Ияшикэй','Школа']) && !hasAnyGenre(item, ['Ужасы','Триллер']),
    rank:item => qualityScore(item) * 70 + compactBonus(item) * 2 + genreHits(item, ['Повседневность','Ияшикэй','Комедия']) * 18
  },
  {
    title:'Коротко и мощно',
    icon:'⏱',
    q:'короткое аниме или фильм на один вечер',
    description:'Фильмы и компактные сезоны до 13 серий — законченная история без обязательства смотреть сотни эпизодов.',
    filter:item => item.kind === 'movie' || (Number(item.episodes || 0) > 0 && Number(item.episodes || 0) <= 13),
    rank:item => qualityScore(item) * 85 + movieBonus(item) * 2 + compactBonus(item)
  },
  {
    title:'Тёмная атмосфера',
    icon:'☾',
    q:'мрачное атмосферное аниме',
    description:'Мрачные миры, психологическое напряжение, сверхъестественное и истории с тяжёлой, цепляющей атмосферой.',
    filter:item => hasAnyGenre(item, ['Ужасы','Триллер','Психология','Сверхъестественное','Мистика','Драма']),
    rank:item => qualityScore(item) * 75 + genreHits(item, ['Ужасы','Триллер','Психология','Мистика']) * 24 + popularityScore(item)
  },
  {
    title:'Свежие хиты',
    icon:'☆',
    q:'лучшие новые аниме последних лет',
    description:'Новые сериалы и фильмы последних сезонов, которые уже успели собрать внимание зрителей.',
    filter:item => Number(item.year || 0) >= 2024,
    rank:item => Number(item.year || 0) * 100 + qualityScore(item) * 20 + popularityScore(item)
  }
]

function numeric(value){
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function qualityScore(item){
  return Math.max(
    numeric(item?.sourceScore),
    numeric(item?.score),
    numeric(item?.popularity),
    numeric(item?.rating),
    numeric(item?.siteRating) * 2
  )
}

function popularityScore(item){
  return Math.max(numeric(item?.popularity), numeric(item?.sourceScore), numeric(item?.score))
}

function normalizedGenres(item){
  return (Array.isArray(item?.genres) ? item.genres : [])
    .map(value => String(value || '').trim().toLowerCase())
    .filter(Boolean)
}

function hasAnyGenre(item, genres){
  const current = normalizedGenres(item)
  return genres.some(genre => current.includes(String(genre).toLowerCase()))
}

function genreHits(item, genres){
  const current = normalizedGenres(item)
  return genres.reduce((count, genre) => count + (current.includes(String(genre).toLowerCase()) ? 1 : 0), 0)
}

function completedBonus(item){
  return ['completed','released'].includes(String(item?.status || '').toLowerCase()) ? 18 : 0
}

function movieBonus(item){
  return String(item?.kind || '').toLowerCase() === 'movie' ? 14 : 0
}

function compactBonus(item){
  const episodes = Number(item?.episodes || 0)
  if(String(item?.kind || '').toLowerCase() === 'movie') return 14
  if(episodes > 0 && episodes <= 13) return 10
  if(episodes > 0 && episodes <= 26) return 5
  return 0
}

function franchiseKey(item){
  return String(item?.title || item?.displayTitle || item?.originalTitle || item?.slug || '')
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(tv|movie|film|season|part)\b/gi, ' ')
    .replace(/\b(сезон|часть|фильм|тв)\b/gi, ' ')
    .replace(/[0-9]+/g, ' ')
    .replace(/[^a-zа-яё0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 4)
    .join(' ')
}

function chooseCollectionItems(anime, rule, usedSlugs, usedFranchises, limit = 5){
  const candidates = anime
    .filter(item => item?.slug && rule.filter(item))
    .sort((a,b) => rule.rank(b) - rule.rank(a))

  const result = []

  for(const item of candidates){
    const key = franchiseKey(item)
    if(usedSlugs.has(item.slug)) continue
    if(key && usedFranchises.has(key)) continue
    result.push(item)
    if(result.length >= limit) break
  }

  if(result.length < limit){
    for(const item of candidates){
      if(result.some(current => current.slug === item.slug)) continue
      if(usedSlugs.has(item.slug)) continue
      result.push(item)
      if(result.length >= limit) break
    }
  }

  if(result.length < limit){
    const fallback = anime
      .filter(item => item?.slug && !usedSlugs.has(item.slug) && !result.some(current => current.slug === item.slug))
      .sort((a,b) => qualityScore(b) - qualityScore(a))

    for(const item of fallback){
      result.push(item)
      if(result.length >= limit) break
    }
  }

  for(const item of result){
    usedSlugs.add(item.slug)
    const key = franchiseKey(item)
    if(key) usedFranchises.add(key)
  }

  return result
}

function Poster({item}){
  return <Link href={`/anime/${item.slug}`} className="poster" prefetch={false}>
    <img loading="lazy" decoding="async" width="320" height="480" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/>
    <GlobalRatingBadge slug={item.slug} score={item.rating} count={item.siteRatingCount}/>
    <div className="poster-info"><b>{item.title}</b><span>{item.meta}</span></div>
  </Link>
}

export default async function CollectionsPage(){
  const anime = await getAnimeList({ limit: 1000 })
  const faq = collectionFaq()
  const schemaItems = COLLECTIONS.map(item => ({ name:item.title, url:`/ai?q=${encodeURIComponent(item.q)}` }))
  const schemas = [
    collectionPageJsonLd({
      name:'Подборки аниме AIanime',
      description:'Живые подборки аниме без повторов: шедевры, сильные сюжеты, приключения, уютные тайтлы, короткие истории и свежие хиты.',
      path:'/collections',
      items:schemaItems
    }),
    webPageJsonLd({
      name:'Подборки аниме по настроению и жанрам',
      description:'Живые подборки аниме без повторов: шедевры, сильные сюжеты, приключения, уютные тайтлы, короткие истории и свежие хиты.',
      path:'/collections'
    }),
    faqJsonLd(faq)
  ].filter(Boolean)

  const usedSlugs = new Set()
  const usedFranchises = new Set()
  const prepared = COLLECTIONS
    .map(rule => ({ ...rule, items:chooseCollectionItems(anime, rule, usedSlugs, usedFranchises, 5) }))
    .filter(section => section.items.length > 0)

  return <main className="page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(schemas)}} />
    <div className="page-head">
      <Link href="/">← На главную</Link>
      <h1>Подборки</h1>
      <p>Не просто фильтры по жанрам: каждая подборка собирается по своему сценарию, сортируется по качеству и не повторяет карточки из соседних блоков.</p>
    </div>

    <details className="seo-fold-copy collections-seo-fold">
      <summary><span><b>Как устроены подборки AIanime</b><small>Коротко о подборках по настроению, формату и атмосфере</small></span><em></em></summary>
      <div className="seo-fold-body">
        <p>Мы разделили каталог на разные сценарии просмотра: начать знакомство с аниме, посмотреть короткую историю, найти сильный сюжет, отдохнуть вечером или выбрать проверенный шедевр.</p>
        <ul>
          <li>Один тайтл не дублируется сразу в нескольких блоках.</li>
          <li>Сезоны одной франшизы стараются не занимать несколько мест подряд.</li>
          <li>Если подходящих тайтлов мало, блок дополняется наиболее сильными вариантами из каталога и не остаётся пустым.</li>
        </ul>
        <div className="seo-fold-faq">{faq.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
      </div>
    </details>

    {prepared.map(section => <section key={section.title}>
      <div className="section-title">
        <h2><span>{section.icon}</span>{section.title}</h2>
        <Link href={`/ai?q=${encodeURIComponent(section.q)}`}>Подобрать ещё ›</Link>
      </div>
      <p className="collection-seo-description">{section.description}</p>
      <div className="poster-row">{section.items.map(item => <Poster item={item} key={item.slug}/>)}</div>
    </section>)}
  </main>
}
