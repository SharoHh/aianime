// AIanime v145: SEO metadata and Schema.org improvements without design changes.
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata = {
  title: 'AIanime — смотреть аниме онлайн на русском',
  description: 'Смотри аниме онлайн на русском в AIanime: каталог тайтлов, AI-подбор по настроению, онгоинги, расписание выхода серий, избранное и история просмотра.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'AIanime — смотреть аниме онлайн на русском',
    description: 'Русскоязычный каталог аниме с онлайн-плеером, AI-рекомендациями, расписанием и подборками.',
    url: '/',
    type: 'website'
  }
}
// AIanime v123: real popularity + latest additions blocks on the home page.

import Link from 'next/link'
import { collections } from '@/lib/data'
import { getWeeklySchedule } from '@/lib/scheduleData'
import { getAnimeList } from '@/lib/animeRepository'
import HomeCollectionsClient from '@/components/HomeCollectionsClient'
import HomeScheduleWidgetClient from '@/components/HomeScheduleWidgetClient'
import GlobalSearchOverlay from '@/components/GlobalSearchOverlay'
import OnboardingClient from '@/components/OnboardingClient'
import SidebarAccountClient from '@/components/SidebarAccountClient'
import HeaderAccountClient from '@/components/HeaderAccountClient'
import SiteStatsClient from '@/components/SiteStatsClient'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import HomeSeasonNowClient from '@/components/HomeSeasonNowClient'
import HomeNewOnSiteClient from '@/components/HomeNewOnSiteClient'
import HomeContinueWatchingWidgetClient from '@/components/HomeContinueWatchingWidgetClient'
import HomeAnimeRouletteClient from '@/components/HomeAnimeRouletteClient'
import HomeAiRecommendationsCarouselClient from '@/components/HomeAiRecommendationsCarouselClient'
import { getPopularitySnapshot, decorateAnimeWithPopularity, rankPopularAnime, rankNewAnime } from '@/lib/popularityData'
import HomeSectionIcon from '@/components/HomeSectionIcon'
import { collectionPageJsonLd, jsonLd } from '@/lib/seo'
import { isPublicReadyAnimeItem } from '@/lib/animeQuality'
function compactAnimeText(value, limit = 220){
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if(!text) return ''
  if(!limit || text.length <= limit) return text
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`
}

function compactAnimeItem(item = {}, options = {}){
  const descriptionLimit = Number(options.descriptionLimit || 220)
  const genresLimit = Number(options.genresLimit || 8)
  return {
    slug: item.slug || '',
    title: compactAnimeText(item.title || 'Без названия', 96),
    titleRu: compactAnimeText(item.titleRu || item.title_ru || '', 96),
    displayTitle: compactAnimeText(item.displayTitle || item.title || '', 96),
    originalTitle: compactAnimeText(item.originalTitle || item.original_title || '', 120),
    englishTitle: compactAnimeText(item.englishTitle || item.titleEnglish || '', 120),
    studio: compactAnimeText(item.studio || '', 80),
    poster: item.poster || '/posters/magic2.svg',
    banner: item.banner || item.bannerUrl || item.poster || '/posters/magic2.svg',
    description: compactAnimeText(item.description || '', descriptionLimit),
    genres: Array.isArray(item.genres) ? item.genres.filter(Boolean).slice(0, genresLimit) : [],
    year: item.year || null,
    meta: compactAnimeText(item.meta || '', 80),
    status: item.status || '',
    kind: item.kind || '',
    episodes: Number(item.episodes || 0) || 0,
    rating: item.rating || '—',
    score: Number(item.score || 0) || 0,
    popularity: Number(item.popularity || 0) || 0,
    siteRatingCount: Number(item.siteRatingCount || 0) || 0,
    livePopularityScore: Number(item.livePopularityScore || 0) || 0,
    livePopularityActions: Number(item.livePopularityActions || 0) || 0,
    livePopularityLabel: item.livePopularityLabel || ''
  }
}

function compactAnimeItems(items = [], limit = 1000, options = {}){
  const safe = Array.isArray(items) ? items : []
  return safe.slice(0, Math.max(1, Number(limit || 1000))).map(item => compactAnimeItem(item, options))
}


const HOME_SEASONS = [
  { from:0, to:2, title:'Аниме зимнего сезона', label:'Зима' },
  { from:3, to:5, title:'Аниме весеннего сезона', label:'Весна' },
  { from:6, to:8, title:'Аниме летнего сезона', label:'Лето' },
  { from:9, to:11, title:'Аниме осеннего сезона', label:'Осень' },
]

function currentHomeSeason(now = new Date()){
  const month = now.getMonth()
  const season = HOME_SEASONS.find(item => month >= item.from && month <= item.to) || HOME_SEASONS[0]
  return { ...season, year:now.getFullYear() }
}

function currentSeasonAnime(anime = [], weeklySchedule = {}, season = currentHomeSeason(), limit = 5){
  const safeAnime = Array.isArray(anime) ? anime : []
  const bySlug = new Map(safeAnime.filter(item => item?.slug).map(item => [item.slug, item]))
  const result = []
  const used = new Set()

  for(const day of weeklySchedule?.days || []){
    for(const release of day?.items || []){
      const item = bySlug.get(release?.slug)
      if(!item?.slug || used.has(item.slug)) continue
      if(item.status !== 'ongoing') continue
      if(Number(item.year || 0) !== season.year) continue
      if(item.kind === 'movie') continue

      used.add(item.slug)
      result.push(item)
      if(result.length >= limit) return result
    }
  }

  // Никаких старых онгоингов в качестве подстраховки: если текущих
  // сезонных релизов меньше пяти, показываем меньше карточек.
  return result
}

const icons = ['home','catalog','schedule','collections','ai','favorites','profile','settings']
const nav = ['Главная','Каталог','Расписание','Подборки','AI-подбор','Избранное','Профиль','Настройки']

function SidebarIcon({ type }){
  const common = {
    viewBox:'0 0 24 24',
    'aria-hidden':'true',
    className:'sidebar-svg-icon',
    fill:'none',
    stroke:'currentColor',
    strokeWidth:'2',
    strokeLinecap:'round',
    strokeLinejoin:'round',
    vectorEffect:'non-scaling-stroke',
    preserveAspectRatio:'xMidYMid meet'
  }

  if(type === 'home') return <svg {...common}><path d="M3 10.8 12 3.8l9 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-6h5v6"/></svg>
  if(type === 'catalog') return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>
  if(type === 'schedule') return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>
  if(type === 'collections') return <svg {...common}><path d="M12 3.5l2.1 5.4 5.4 2.1-5.4 2.1-2.1 5.4-2.1-5.4-5.4-2.1 5.4-2.1L12 3.5z"/></svg>
  if(type === 'ai') return <svg {...common}><rect x="7" y="7" width="10" height="10" rx="2.5"/><path d="M12 3.5V7M12 17v3.5M3.5 12H7M17 12h3.5M9.8 12h4.4M12 9.8v4.4"/></svg>
  if(type === 'favorites') return <svg {...common}><path d="M20.5 8.8c0 5.3-8.5 10-8.5 10s-8.5-4.7-8.5-10A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.5 2.6Z"/></svg>
  if(type === 'profile') return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.6-4 13.4-4 15 0"/></svg>
  return <svg {...common}><circle cx="12" cy="12" r="3.5"/><path d="M12 2.8v2.2M12 19v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.8 12h2.2M19 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6"/></svg>
}

function Sidebar(){return <aside className="sidebar">
  <div className="brand brand-aianime brand-premium">
    <div className="brand-mark" aria-hidden="true">
      <span className="brand-mark-glow" />
      <img src="/aianime-logo.png" alt="" width="44" height="44" decoding="async" />
    </div>
    <div className="brand-copy">
      <b>Aianime</b>
      <span>AI-подбор аниме</span>
    </div>
  </div>
  <nav className="sidebar-nav">
    {nav.slice(0,6).map((n,i)=><Link className={'nav '+(i===0?'active':'')} href={i===1?'/catalog':i===2?'/schedule':i===3?'/collections':i===4?'/ai':i===5?'/favorites':'/'} key={n}><span className="nav-icon"><SidebarIcon type={icons[i]}/></span>{n}</Link>)}
  </nav>
  <SidebarAccountClient/>
</aside>}
function hasGlobalRating(item){return item?.siteRatingCount > 0 && String(item?.rating || '') !== '—'}
function ratingToneClass(item){
  const value = Number(item?.rating || 0)
  if(!Number.isFinite(value) || value <= 0) return 'rating-tone-low'
  if(value >= 8.5) return 'rating-tone-gold'
  if(value >= 6.5) return 'rating-tone-orange'
  return 'rating-tone-red'
}
function Poster({item}){return <Link href={`/anime/${item.slug}`} className="poster" prefetch={false}><img loading="lazy" decoding="async" width="320" height="480" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/><GlobalRatingBadge slug={item.slug} score={item.rating} count={item.siteRatingCount}/><div className="poster-info"><b>{item.title}</b><span>{item.meta}</span></div></Link>}
function Continue({item}){return <Link href={`/anime/${item.slug}`} className="continue-card" prefetch={false}><img loading="lazy" decoding="async" width="160" height="230" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/><div className="play">▶</div><div className="continue-info"><b>{item.title}</b><span>{item.meta}</span><div className="bar"><i style={{width:item.progress+'%'}}/></div></div><em>{item.progress}%</em></Link>}
function SectionTitle({icon,title}){return <div className="section-title section-title-clean-icons"><h2><HomeSectionIcon type={icon}/>{title}</h2><Link href="/catalog">Смотреть все ›</Link></div>}

function formatStat(value){
  return new Intl.NumberFormat('ru-RU').format(Number(value) || 0)
}

function buildSiteStats(anime, todaySchedule, totalAnimeCount = null){
  const list = Array.isArray(anime) ? anime : []
  const animeCount = Number.isFinite(Number(totalAnimeCount)) ? Number(totalAnimeCount) : list.length
  const newEpisodesToday = Array.isArray(todaySchedule) ? todaySchedule.length : 0

  return [
    { key:'accounts', icon:'accounts', label:'Аккаунтов на сайте', value:'—' },
    { key:'anime', icon:'anime', label:'Всего аниме', value:formatStat(animeCount) },
    { key:'episodesToday', icon:'episodesToday', label:'Новых серий сегодня', value:formatStat(newEpisodesToday) },
    { key:'comments', icon:'comments', label:'Комментариев', value:'—' },
    { key:'openTabs', icon:'openTabs', label:'Вкладок открыто', value:'1', dividerBefore:true },
    { key:'online', icon:'online', label:'Пользователей онлайн', value:'1', isOnline:true },
  ]
}

function HomeAiHero({ recommendations = [] }){
  const moods = [
    { icon:'😌', label:'Расслабиться', href:'/ai?q=спокойное%20уютное%20аниме%20на%20вечер' },
    { icon:'😂', label:'Посмеяться', href:'/ai?q=смешное%20аниме%20для%20хорошего%20настроения' },
    { icon:'🥲', label:'Погрустить', href:'/ai?q=трогательное%20или%20грустное%20аниме' },
    { icon:'🔥', label:'Экшен', href:'/ai?q=динамичное%20экшен%20аниме' },
    { icon:'💜', label:'Ещё', href:'/ai' },
  ]

  return <section className="hero ai-dashboard-hero">
    <div className="ai-dashboard-layout">
      <div className="ai-dashboard-copy">
        <span className="ai-dashboard-badge">AI-подбор аниме</span>
        <h1>Что хочется <br/>посмотреть сегодня?</h1>
        <p>Расскажи о своём настроении или выбери вариант ниже — наш AI подберёт идеальное аниме специально для тебя.</p>
        <div className="ai-dashboard-moods" aria-label="Быстрый выбор настроения">
          {moods.map(mood => <Link key={mood.label} href={mood.href} className="ai-dashboard-mood" prefetch={false}><b aria-hidden="true">{mood.icon}</b><span>{mood.label}</span></Link>)}
        </div>
        <div className="ai-dashboard-actions">
          <Link href="/ai" className="primary">✨ Подобрать аниме</Link>
          <label htmlFor="how-modal-toggle" className="secondary how-works-btn">Как это работает?</label>
        </div>
        <div className="how-modal" aria-hidden="true">
          <label className="how-modal-backdrop" htmlFor="how-modal-toggle" />
          <div className="how-modal-card" role="dialog" aria-modal="true" aria-labelledby="how-modal-title">
            <label className="how-modal-close" htmlFor="how-modal-toggle" aria-label="Закрыть">×</label>
            <h2 id="how-modal-title">Как это работает?</h2>
            <div className="how-modal-steps">
              <article><b>☺</b><div><strong>Выбери настроение</strong><span>Отметь вайб или просто опиши, что хочется посмотреть прямо сейчас.</span></div></article>
              <article><b className="how-card-icon"><HomeSectionIcon type="ai"/></b><div><strong>AI подберёт похожие тайтлы</strong><span>Система учитывает жанры, твой запрос и уже просмотренные аниме.</span></div></article>
              <article><b>▶</b><div><strong>Открой рекомендацию и смотри</strong><span>Переходи к понравившемуся тайтлу или запускай полный AI-подбор.</span></div></article>
            </div>
          </div>
        </div>
      </div>
      <div className="ai-dashboard-side">
        <HomeAiRecommendationsCarouselClient items={recommendations}/>
      </div>
    </div>
  </section>
}

function SiteStatsWidget({animeCount, weeklySchedule}){
  return <SiteStatsClient initialStats={buildSiteStats([], weeklySchedule?.todayItems || [], animeCount)} />
}

function RightPanel({anime, popular, animeCount, weeklySchedule}){return <aside className="rightcol">
  <HomeScheduleWidgetClient scheduleDays={weeklySchedule?.days || []} initialDay={weeklySchedule?.todayIndex || 0}/>
  <HomeContinueWatchingWidgetClient popular={popular}/>
  <HomeAnimeRouletteClient items={anime}/>
  <SiteStatsWidget animeCount={animeCount} weeklySchedule={weeklySchedule}/>
</aside>}
export default async function Home(){const now = new Date(); const season = currentHomeSeason(now); const [animeRaw, weeklySchedule, popularitySnapshot] = await Promise.all([getAnimeList({limit:1000}), getWeeklySchedule({ now }), getPopularitySnapshot()]); const decoratedAnime = decorateAnimeWithPopularity(animeRaw, popularitySnapshot); const anime = decoratedAnime.filter(isPublicReadyAnimeItem); const clientAnime = compactAnimeItems(anime, 160, { descriptionLimit: 180 }); const newestAnime = rankNewAnime(anime, 20); const newestVisibleSlugs = new Set(newestAnime.slice(0, 10).map(item => item?.slug).filter(Boolean)); const popularAnime = rankPopularAnime(anime.filter(item => !newestVisibleSlugs.has(item?.slug)), 24); const seasonAnime = currentSeasonAnime(anime, weeklySchedule, season, 5); const popularClient = compactAnimeItems(popularAnime, 24, { descriptionLimit: 160 }); const seasonClient = compactAnimeItems(seasonAnime, 5, { descriptionLimit: 160 }); const newestClient = compactAnimeItems(newestAnime, 20, { descriptionLimit: 160 }); return <main className="shell"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(collectionPageJsonLd({ name:'AIanime — аниме онлайн на русском', description:'Главная страница AIanime с сезонными онгоингами, новыми тайтлами, подборками, расписанием и AI-рекомендациями.', path:'/', items:[...seasonAnime, ...newestAnime, ...popularAnime].slice(0, 20).map(item => ({ title:item.title, slug:item.slug })) }))}} /><Sidebar/><section className="content"><input className="how-modal-toggle" id="how-modal-toggle" type="checkbox" />
<header className="topbar"><GlobalSearchOverlay items={clientAnime.slice(0,80)}/><div className="actions"><Link href="/notifications" className="top-action">🔔</Link><Link href="/favorites" className="top-action">♡</Link><HeaderAccountClient/></div></header><HomeAiHero recommendations={compactAnimeItems(popularAnime.slice(0,9), 9, { descriptionLimit: 120, genresLimit: 2 })}/>
<HomeSeasonNowClient anime={seasonClient} title={season.title} seasonLabel={`${season.label} ${season.year}`}/><HomeNewOnSiteClient anime={newestClient}/><SectionTitle icon="collections" title="Подборки для тебя"/><HomeCollectionsClient collections={collections}/></section><RightPanel anime={clientAnime} popular={popularClient} animeCount={anime.length} weeklySchedule={weeklySchedule}/><OnboardingClient/></main>}
