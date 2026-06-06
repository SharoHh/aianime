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
import ContinueWatchingClient from '@/components/ContinueWatchingClient'
import HomeMoodPickerClient from '@/components/HomeMoodPickerClient'
import HomeCollectionsClient from '@/components/HomeCollectionsClient'
import HomeScheduleWidgetClient from '@/components/HomeScheduleWidgetClient'
import GlobalSearchOverlay from '@/components/GlobalSearchOverlay'
import OnboardingClient from '@/components/OnboardingClient'
import SidebarAccountClient from '@/components/SidebarAccountClient'
import HeaderAccountClient from '@/components/HeaderAccountClient'
import SiteStatsClient from '@/components/SiteStatsClient'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import HomePopularNowClient from '@/components/HomePopularNowClient'
import HomeNewOnSiteClient from '@/components/HomeNewOnSiteClient'
import { getPopularitySnapshot, decorateAnimeWithPopularity, rankPopularAnime, rankNewAnime } from '@/lib/popularityData'
import HomeSectionIcon from '@/components/HomeSectionIcon'
import { collectionPageJsonLd, jsonLd } from '@/lib/seo'
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
function Poster({item}){return <Link href={`/anime/${item.slug}`} className="poster"><img loading="lazy" decoding="async" width="320" height="480" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/><GlobalRatingBadge slug={item.slug} score={item.rating} count={item.siteRatingCount}/><div className="poster-info"><b>{item.title}</b><span>{item.meta}</span></div></Link>}
function Continue({item}){return <Link href={`/anime/${item.slug}`} className="continue-card"><img loading="lazy" decoding="async" width="160" height="230" src={item.poster} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'}/><div className="play">▶</div><div className="continue-info"><b>{item.title}</b><span>{item.meta}</span><div className="bar"><i style={{width:item.progress+'%'}}/></div></div><em>{item.progress}%</em></Link>}
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
    { key:'openTabs', icon:'openTabs', label:'Вкладок открыто', value:'—', dividerBefore:true },
    { key:'online', icon:'online', label:'Пользователей онлайн', value:'—', isOnline:true },
  ]
}

function SiteStatsWidget({animeCount, weeklySchedule}){
  return <SiteStatsClient initialStats={buildSiteStats([], weeklySchedule?.todayItems || [], animeCount)} />
}

function RightPanel({anime, animeCount, weeklySchedule}){return <aside className="rightcol">
  <HomeScheduleWidgetClient scheduleDays={weeklySchedule?.days || []} initialDay={weeklySchedule?.todayIndex || 0}/>
  <HomeMoodPickerClient anime={anime.slice(0,40)}/>
  <div className="widget mini-list"><div className="widget-head"><h3>Рекомендуем для тебя</h3><Link href="/ai?q=подбери%20аниме%20для%20меня">Смотреть все</Link></div>{anime.slice(5,9).map(a=><Link href={`/anime/${a.slug}`} className="mini" key={a.slug}><img loading="lazy" decoding="async" width="72" height="102" src={a.poster} alt={a.title ? `Постер аниме ${a.title}` : 'Постер аниме'}/><div><b>{a.title}</b><span>{a.meta}</span></div><GlobalRatingBadge slug={a.slug} score={a.rating} count={a.siteRatingCount} className="mini-rating-gold"/></Link>)}</div>
  <SiteStatsWidget animeCount={animeCount} weeklySchedule={weeklySchedule}/>
</aside>}
export default async function Home(){const [animeRaw, weeklySchedule, popularitySnapshot] = await Promise.all([getAnimeList({limit:720}), getWeeklySchedule(), getPopularitySnapshot()]); const anime = decorateAnimeWithPopularity(animeRaw, popularitySnapshot); const clientAnime = compactAnimeItems(anime, 160, { descriptionLimit: 180 }); const popularAnime = rankPopularAnime(anime, 24); const newestAnime = rankNewAnime(anime, 12); const popularClient = compactAnimeItems(popularAnime, 24, { descriptionLimit: 160 }); const newestClient = compactAnimeItems(newestAnime, 12, { descriptionLimit: 160 }); return <main className="shell"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(collectionPageJsonLd({ name:'AIanime — аниме онлайн на русском', description:'Главная страница AIanime с новыми тайтлами, популярным аниме, подборками, расписанием и AI-рекомендациями.', path:'/', items:[...newestAnime, ...popularAnime].slice(0, 20).map(item => ({ title:item.title, slug:item.slug })) }))}} /><Sidebar/><section className="content"><input className="how-modal-toggle" id="how-modal-toggle" type="checkbox" />
<header className="topbar"><GlobalSearchOverlay items={clientAnime.slice(0,80)}/><div className="actions"><Link href="/notifications" className="top-action">🔔</Link><Link href="/favorites" className="top-action">♡</Link><HeaderAccountClient/></div></header><section className="hero ai-hero ai-hero-image">
  <picture className="hero-lcp-picture" aria-hidden="true">
    <source media="(max-width: 760px)" srcSet="/images/ai-hero-768.webp" />
    <img className="hero-lcp-image" src="/images/ai-hero-1280.webp" alt="" width="1280" height="720" sizes="(max-width: 760px) 100vw, 72vw" loading="eager" decoding="async" fetchPriority="high" />
  </picture>
  <div className="hero-image-overlay" />
  <div className="hero-copy">
    <span>AI РЕКОМЕНДАЦИЯ ДНЯ</span>
    <h1>Твоё следующее <br/><strong>любимое</strong> аниме</h1>
    <p>Умный подбор на основе твоих предпочтений и настроения</p>
    <div className="hero-actions"><Link href="/ai" className="primary">Подобрать аниме</Link><label htmlFor="how-modal-toggle" className="secondary how-works-btn">Как это работает?</label><div className="how-modal" aria-hidden="true">
      <label className="how-modal-backdrop" htmlFor="how-modal-toggle" />
      <div className="how-modal-card" role="dialog" aria-modal="true" aria-labelledby="how-modal-title">
        <label className="how-modal-close" htmlFor="how-modal-toggle" aria-label="Закрыть">×</label>
        <h2 id="how-modal-title">Как это работает?</h2>
        <div className="how-modal-steps">
          <article><b>☺</b><div><strong>Опиши настроение</strong><span>Расскажи, что хочешь почувствовать: умиротворение, драйв, ностальгию или что-то другое.</span></div></article>
          <article><b className="how-card-icon"><HomeSectionIcon type="ai"/></b><div><strong>AI найдёт похожие тайтлы</strong><span>Наша система анализирует твои предпочтения и находит аниме, которые тебе подойдут.</span></div></article>
          <article><b>▶</b><div><strong>Открой подборку и смотри</strong><span>Получай персональные рекомендации и наслаждайся просмотром!</span></div></article>
        </div>
      </div>
    </div></div>
    <div className="hero-prompts"><Link href="/ai?q=уютное%20аниме%20на%20вечер">Уютное на вечер</Link><Link href="/ai?q=мрачный%20психологический%20триллер">Психология</Link><Link href="/ai?q=романтика%20без%20кринжа">Романтика</Link></div>
  </div>
</section>
<HomeNewOnSiteClient anime={newestClient}/><HomePopularNowClient anime={popularClient}/><SectionTitle icon="continue" title="Продолжить просмотр"/><ContinueWatchingClient/><SectionTitle icon="collections" title="Подборки для тебя"/><HomeCollectionsClient collections={collections}/></section><RightPanel anime={clientAnime} animeCount={anime.length} weeklySchedule={weeklySchedule}/><OnboardingClient/></main>}
