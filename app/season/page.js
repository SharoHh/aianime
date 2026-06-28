export const dynamic = 'force-dynamic'

import Link from 'next/link'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import HomeSectionIcon from '@/components/HomeSectionIcon'
import { getAnimeList } from '@/lib/animeRepository'
import { getWeeklySchedule } from '@/lib/scheduleData'
import { collectionPageJsonLd, jsonLd } from '@/lib/seo'
import styles from './season.module.css'

const SECTION_LIMIT = 5

const SEASON_BY_MONTH = [
  { from: 0, to: 2, name: 'Зима', accent: '❄' },
  { from: 3, to: 5, name: 'Весна', accent: '✦' },
  { from: 6, to: 8, name: 'Лето', accent: '☀' },
  { from: 9, to: 11, name: 'Осень', accent: '◆' },
]

function currentSeasonMeta(now = new Date()){
  const month = now.getMonth()
  const season = SEASON_BY_MONTH.find(item => month >= item.from && month <= item.to) || SEASON_BY_MONTH[0]
  return { ...season, year: now.getFullYear() }
}

function asNumber(value){
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function asTime(value){
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function ratingValue(item){
  return Math.max(asNumber(item?.sourceScore), asNumber(item?.popularity), asNumber(item?.score))
}

function recentValue(item){
  return Math.max(asTime(item?.addedAt), asTime(item?.createdAt), asTime(item?.updatedAt))
}

function rankAnime(a, b){
  return ratingValue(b) - ratingValue(a)
    || asNumber(b?.year) - asNumber(a?.year)
    || recentValue(b) - recentValue(a)
}

function rankRecent(a, b){
  return recentValue(b) - recentValue(a)
    || asNumber(b?.year) - asNumber(a?.year)
    || ratingValue(b) - ratingValue(a)
}

function normalizeTitle(value){
  return String(value || '')
    .toLowerCase()
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:season|part|cour|movie|tv)\b/gi, ' ')
    .replace(/\b\d+(?:st|nd|rd|th)?\b/gi, ' ')
    .replace(/(?:сезон|часть|глава|фильм)\s*\d*/gi, ' ')
    .replace(/[–—:;,.!?/\\_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function franchiseKey(item){
  return normalizeTitle(item?.title || item?.originalTitle || item?.slug) || String(item?.slug || '')
}

function isContinuation(item){
  const text = `${item?.title || ''} ${item?.originalTitle || ''} ${item?.slug || ''}`.toLowerCase()
  return /(?:\bseason\s*[2-9]|\bpart\s*[2-9]|\bcour\s*[2-9]|\b[2-9](?:nd|rd|th)\s+season|\bсезон\s*[2-9]|\b[2-9]\s*сезон|\bчаст[ьи]\s*[2-9]|\b[2-9]\s*част[ьи]|(?:-|\s)[2-9](?:\s|$))/i.test(text)
}

function episodeCount(item){
  return Math.max(0, asNumber(item?.episodes))
}

function takeUnique(candidates, usedSlugs, usedFranchises, limit = SECTION_LIMIT){
  const result = []

  for(const item of candidates){
    if(!item?.slug || usedSlugs.has(item.slug)) continue
    const key = franchiseKey(item)
    if(key && usedFranchises.has(key)) continue

    result.push(item)
    usedSlugs.add(item.slug)
    if(key) usedFranchises.add(key)
    if(result.length >= limit) break
  }

  return result
}

function cardMeta(item){
  if(item?.seasonMeta) return item.seasonMeta
  if(item?.kind === 'movie') return `${item.year || '—'} · Фильм`
  const episodes = episodeCount(item)
  if(item?.status === 'ongoing') return `Онгоинг${episodes ? ` · ${episodes} серий` : ''}`
  return `${item?.year || '—'}${episodes ? ` · ${episodes} серий` : ''}`
}

function Poster({ item }){
  return <Link href={`/anime/${item.slug}`} className={`poster ${styles.poster}`} prefetch={false}>
    <img loading="lazy" decoding="async" width="320" height="480" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'} />
    <GlobalRatingBadge slug={item.slug} score={item.rating} count={item.siteRatingCount} />
    <div className={styles.posterStatus}>{item.status === 'ongoing' ? 'В эфире' : item.kind === 'movie' ? 'Фильм' : item.year || 'Аниме'}</div>
    <div className="poster-info">
      <b>{item.title}</b>
      <span>{cardMeta(item)}</span>
    </div>
  </Link>
}

function SeasonSection({ icon, title, description, href, hrefLabel = 'Смотреть все', items }){
  if(!items?.length) return null

  return <section className={styles.section}>
    <div className={`${styles.sectionHeading} section-title`}>
      <div>
        <h2><HomeSectionIcon type={icon}/>{title}</h2>
        <p>{description}</p>
      </div>
      <Link href={href}>{hrefLabel} ›</Link>
    </div>
    <div className={`poster-row ${styles.posterGrid}`}>
      {items.map(item => <Poster key={item.slug} item={item} />)}
    </div>
  </section>
}

export const metadata = {
  title: 'Сезонное аниме и онгоинги — AIanime',
  description: 'Онгоинги текущего сезона, новые серии недели, свежие старты, продолжения и лучшие сезонные релизы на AIanime.',
  alternates: { canonical: '/season' },
  openGraph: {
    title: 'Сезонное аниме и онгоинги — AIanime',
    description: 'Онгоинги текущего сезона, новые серии недели, свежие старты, продолжения и лучшие сезонные релизы.',
    url: '/season',
    type: 'website',
  },
}

export default async function SeasonPage(){
  const now = new Date()
  const season = currentSeasonMeta(now)
  const [anime, schedule] = await Promise.all([
    getAnimeList({ limit: 1000 }),
    getWeeklySchedule({ now, limit: 400 }),
  ])

  const available = anime.filter(item => item?.slug && item?.poster && item?.hasRealPoster !== false && !item?.restricted)
  const animeBySlug = new Map(available.map(item => [item.slug, item]))
  const usedSlugs = new Set()
  const usedFranchises = new Set()

  const weeklyMetaBySlug = new Map()
  const weeklyCandidates = []
  for(const day of schedule?.days || []){
    for(const release of day?.items || []){
      const item = animeBySlug.get(release.slug)
      if(!item || weeklyMetaBySlug.has(item.slug)) continue
      weeklyMetaBySlug.set(item.slug, `${day.shortName}, ${release.time} · ${release.meta}`)
      weeklyCandidates.push({ ...item, seasonMeta: `${day.shortName}, ${release.time} · ${release.meta}` })
    }
  }

  const ongoingPool = available
    .filter(item => item.status === 'ongoing')
    .sort(rankAnime)

  const currentYearPool = available
    .filter(item => asNumber(item.year) >= season.year - 1)
    .sort(rankRecent)

  const hasWeeklySchedule = weeklyCandidates.length > 0
  const weekly = takeUnique(
    hasWeeklySchedule ? weeklyCandidates : [...ongoingPool].sort(rankRecent),
    usedSlugs,
    usedFranchises,
  )

  const topOngoing = takeUnique(
    ongoingPool,
    usedSlugs,
    usedFranchises,
  )

  const freshStarts = takeUnique(
    currentYearPool.filter(item => item.kind !== 'movie' && !isContinuation(item)),
    usedSlugs,
    usedFranchises,
  )

  const continuations = takeUnique(
    currentYearPool.filter(isContinuation).sort(rankAnime),
    usedSlugs,
    usedFranchises,
  )

  const catchUp = takeUnique(
    ongoingPool
      .filter(item => {
        const episodes = episodeCount(item)
        return episodes > 0 && episodes <= 13
      })
      .sort((a, b) => episodeCount(a) - episodeCount(b) || rankAnime(a, b)),
    usedSlugs,
    usedFranchises,
  )

  const movies = takeUnique(
    available
      .filter(item => item.kind === 'movie' && asNumber(item.year) >= season.year - 2)
      .sort(rankAnime),
    usedSlugs,
    usedFranchises,
  )

  const sections = [
    {
      icon: 'schedule',
      title: hasWeeklySchedule ? 'Новые серии на этой неделе' : 'Самые свежие онгоинги',
      description: hasWeeklySchedule
        ? 'Тайтлы с реальными датами выхода из расписания — без случайных карточек из каталога.'
        : 'Расписание пока пустое, поэтому здесь показаны недавно обновлённые тайтлы, которые продолжают выходить.',
      href: hasWeeklySchedule ? '/schedule' : '/catalog',
      hrefLabel: hasWeeklySchedule ? 'Расписание' : 'Все онгоинги',
      items: weekly,
    },
    {
      icon: 'popular',
      title: 'Лучшие онгоинги',
      description: 'Сериалы, которые действительно продолжают выходить сейчас, отсортированные по рейтингу источников.',
      href: '/catalog',
      items: topOngoing,
    },
    {
      icon: 'new',
      title: 'Свежие старты',
      description: 'Новые самостоятельные истории последних сезонов — без продолжений и повторов франшиз.',
      href: '/catalog',
      items: freshStarts,
    },
    {
      icon: 'continue',
      title: 'Продолжения и новые сезоны',
      description: 'Возвращение знакомых героев, вторые сезоны и новые части популярных историй.',
      href: '/collections',
      items: continuations,
    },
    {
      icon: 'ongoing',
      title: 'Можно быстро догнать',
      description: 'Онгоинги до 13 серий: удобно начать сейчас и успеть присоединиться к текущему просмотру.',
      href: '/catalog',
      items: catchUp,
    },
    {
      icon: 'top',
      title: 'Фильмы последних сезонов',
      description: 'Полнометражные релизы последних лет для просмотра за один вечер.',
      href: '/catalog',
      items: movies,
    },
  ].filter(section => section.items.length)

  const schemaItems = sections
    .flatMap(section => section.items)
    .filter((item, index, list) => item?.slug && list.findIndex(candidate => candidate.slug === item.slug) === index)
    .slice(0, 24)
    .map(item => ({ title: item.title, slug: item.slug }))

  const ongoingCount = available.filter(item => item.status === 'ongoing').length
  const currentYearCount = available.filter(item => asNumber(item.year) === season.year).length
  const movieCount = available.filter(item => item.kind === 'movie' && asNumber(item.year) >= season.year - 1).length
  const weeklyCount = weeklyMetaBySlug.size

  return <main className={`page season-page ${styles.page}`}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(collectionPageJsonLd({
      name: `Онгоинги сезона: ${season.name} ${season.year}`,
      description: 'Новые серии недели, лучшие онгоинги, свежие старты, продолжения и фильмы текущего сезона.',
      path: '/season',
      items: schemaItems,
    })) }} />

    <div className={`page-head ${styles.pageHead}`}>
      <Link href="/">← На главную</Link>
      <h1>Онгоинги и сезонные новинки</h1>
      <p>Реальные релизы недели, сильные онгоинги и новые тайтлы — без одинаковых блоков и повторов.</p>
    </div>

    <section className={`widget ${styles.hero}`}>
      <div className={styles.heroCopy}>
        <span className={styles.seasonBadge}>{season.accent} {season.name} {season.year}</span>
        <h2>Что смотреть прямо сейчас</h2>
        <p>Страница разделяет расписание, онгоинги, новые старты, продолжения и фильмы. Один тайтл показывается только в одной подборке.</p>
        <div className={styles.heroActions}>
          <Link className="primary" href="/schedule">Открыть расписание</Link>
          <Link className={styles.secondaryAction} href="/catalog">Все онгоинги</Link>
        </div>
      </div>

      <div className={styles.stats} aria-label="Статистика сезона">
        <article><strong>{ongoingCount}</strong><span>идут сейчас</span></article>
        <article><strong>{weeklyCount}</strong><span>в расписании недели</span></article>
        <article><strong>{currentYearCount}</strong><span>релизов {season.year}</span></article>
        <article><strong>{movieCount}</strong><span>свежих фильмов</span></article>
      </div>
    </section>

    <nav className={styles.quickNav} aria-label="Разделы страницы">
      {sections.map(section => <a key={section.title} href={`#${section.title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-')}`}>{section.title}</a>)}
    </nav>

    {sections.map(section => <div key={section.title} id={section.title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-')}>
      <SeasonSection {...section} />
    </div>)}
  </main>
}
