export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAnimeList, getAnimeBySlugFromRepo, getEpisodesBySlug } from '@/lib/animeRepository'
import { recommendAnime } from '@/lib/aiAnime'
import TitleActions from '@/components/TitleActions'
import TitleAuthActionClient from '@/components/TitleAuthActionClient'
import CommentsClient from '@/components/CommentsClient'
import KodikPlayerClient from '@/components/KodikPlayerClient'
import WatchTracker from '@/components/WatchTracker'
import { encodeSlug } from '@/lib/routeSlugs'
import { cleanPublicText, isPlaceholderText } from '@/lib/ruContent'

export async function generateMetadata({ params }){
  const resolvedParams = await params
  const item = await getAnimeBySlugFromRepo(resolvedParams.slug)
  if(!item){
    return {
      title: 'Тайтл не найден — Aianime',
      description: 'Этот тайтл удалён или больше не доступен в каталоге Aianime.'
    }
  }
  const title = cleanPublicText(item.title) || 'Без названия'
  const description = cleanPublicText(item.description)?.slice(0, 160) || 'Аниме онлайн: описание, серии, комментарии и похожие тайтлы.'
  return {
    title: `${title} смотреть онлайн — Aianime`,
    description,
    openGraph: { title, description, images: [item.poster] }
  }
}


function numericRating(value){
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number.toFixed(1) : '—'
}

function aiMatchPercent(item){
  const base = Number(item?.score || item?.rating || 0)
  if(!Number.isFinite(base) || base <= 0) return '—'
  return `${Math.min(98, Math.max(62, Math.round(base * 10)))}%`
}

function externalSearchUrl(source, item){
  const query = encodeURIComponent(item?.originalTitle || item?.englishTitle || item?.title || item?.slug || 'anime')
  if(source === 'mal'){
    const malId = Number(item?.malId)
    if(Number.isFinite(malId) && malId > 0) return `https://myanimelist.net/anime/${malId}`
    return `https://myanimelist.net/anime.php?q=${query}`
  }
  if(source === 'shiki'){
    return `https://shikimori.one/animes?search=${query}`
  }
  return null
}

function statusLabel(status){
  if(status === 'ongoing') return 'Выходит'
  if(status === 'anons') return 'Анонс'
  return 'Завершён'
}

function visibleInfoRows(rows){
  return rows
    .map(([label, value]) => [label, cleanPublicText(value)])
    .filter(([, value]) => !isPlaceholderText(value))
}


export default async function AnimePage({ params, searchParams }){
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  if(String(resolvedParams.slug || '').startsWith('catalog-title-')) notFound()
  const item = await getAnimeBySlugFromRepo(resolvedParams.slug)
  if(!item) notFound()
  const title = cleanPublicText(item.title) || 'Без названия'
  const originalTitle = cleanPublicText(item.originalTitle || item.englishTitle || item.title)
  const description = cleanPublicText(item.description) || 'Описание скоро появится.'
  const [allAnime, episodes] = await Promise.all([
    getAnimeList({limit:220}),
    getEpisodesBySlug(item.slug, item.episodes || item.episodesList?.length || 12)
  ])
  const selectedEpisodeNumber = Math.max(1, Number(resolvedSearchParams?.episode || 1) || 1)
  const currentEpisode = episodes.find(e => Number(e.episodeNumber) === selectedEpisodeNumber) || episodes[0]
  const currentEpisodeNumber = Number(currentEpisode?.episodeNumber || selectedEpisodeNumber || 1)
  const nextEpisode = episodes.find(e => Number(e.episodeNumber) > currentEpisodeNumber) || episodes[0]
  const similar = recommendAnime(allAnime, `похожие на ${title}`, { baseAnime: item, limit: 6 })

  const info = visibleInfoRows([
    ['Статус', statusLabel(item.status)],
    ['Тип', item.kind === 'movie' ? 'Фильм' : 'Сериал'],
    ['Год выхода', item.year || '—'],
    ['Возрастной рейтинг', item.ageRating || '16+'],
    ['Первоисточник', item.source || 'Манга / оригинал'],
    ['Студия', item.studio || '—'],
    ['Режиссёр', item.director || 'Будет добавлено'],
    ['Количество серий', item.episodes || item.episodesList?.length || episodes.length],
    ['Перевод', item.translationTitle || 'Kodik / будет добавлено'],
    ['Озвучка', item.translationTitle || currentEpisode?.voice || 'default'],
  ])

  return <main className="anime-compact-page">
    <nav className="title-top-nav title-top-nav-premium">
      <Link href="/" className="title-nav-brand"><img src="/aianime-logo.png" alt="Aianime"/><div><b>Aianime</b><span>AI anime platform</span></div></Link>
      <div className="title-nav-links">
        <Link href="/">Главная</Link>
        <Link href="/catalog">Каталог</Link>
        <Link href="/genres">Жанры</Link>
        <Link href="/top">Топы</Link>
        <Link href="#player">Плеер</Link>
      </div>
      <div className="title-nav-actions">
        <Link href="/ai" className="title-nav-ai">AI-подбор</Link>
        <TitleAuthActionClient/>
      </div>
    </nav>
    <section className="anime-compact-card compact-card-polished"><img className="compact-bg-glow" loading="lazy" decoding="async" src={item.poster} alt=""/>
      <div className="anime-compact-left">
        <nav className="compact-breadcrumb"><Link href="/">← На главную</Link><span>/</span><Link href="/catalog">Каталог</Link></nav>

        <h1>{title}</h1>

        <div className="compact-aliases">
          <span>{originalTitle || title}</span>
          <span>{item.kind === 'movie' ? 'Фильм' : 'Сериал'}</span>
          <span>{item.year || '—'}</span>
        </div>

        <div className="compact-rating-row" aria-label="Рейтинги и быстрые ссылки">
          <div className="main-rate" title="Средняя оценка тайтла"><b>{numericRating(item.score || item.rating)}</b><span>рейтинг</span></div>
          <a className="rate-chip shiki is-link" href={externalSearchUrl('shiki', item)} target="_blank" rel="noopener noreferrer" title="Открыть тайтл на Shikimori">Shiki {numericRating(item.score || item.rating)}</a>
          <Link className="rate-chip ai is-link" href={`/ai?similar=${item.slug}`} title="Найти похожие тайтлы через AI">AI {aiMatchPercent(item)}</Link>
          <a className="rate-chip mal is-link" href={externalSearchUrl('mal', item)} target="_blank" rel="noopener noreferrer" title="Открыть тайтл на MyAnimeList">MAL {numericRating(item.score || item.rating)}</a>
        </div>

        <div className="compact-info-list">
          {info.map(([label,value])=><div key={label}>
            <span>{label}:</span>
            <b>{value}</b>
          </div>)}
        </div>

        <div className="compact-genres">
          {item.genres.slice(0,8).map(g=><Link href={`/genre/${encodeSlug(g)}`} key={g}>{g}</Link>)}
        </div>

        <p className="compact-description">{description}</p>

        <div className="compact-actions">
          <Link className="compact-watch" href={`?episode=${currentEpisodeNumber}#player`}>▶ Смотреть</Link>
          <Link className="compact-ai" href={`/ai?similar=${item.slug}`}>✦ Похожие через AI</Link>
          <TitleActions item={item}/>
        </div>
      </div>

      <aside className="anime-compact-poster">
        <img loading="eager" decoding="async" src={item.poster} alt={title}/>
        <div className="poster-rank">AI рекомендация</div>
      </aside>
    </section>

    <section className="compact-player-section" id="player">
      <div className="compact-section-head"><h2>Плеер</h2><a href="#episodes">Серии ↓</a></div>
      <KodikPlayerClient
        slug={item.slug}
        title={title}
        banner={item.banner || item.poster}
        episode={currentEpisodeNumber}
        nextEpisode={nextEpisode?.episodeNumber || currentEpisodeNumber + 1}
        voice={item.translationTitle || currentEpisode?.voice || 'Kodik'}
        translationTitle={item.translationTitle}
        quality={item.quality}
        initialEmbedUrl={currentEpisode?.embedUrl || item.kodikLink || null}
        initialVoice={currentEpisode?.voice || item.translationTitle || null}
        initialQuality={item.quality || null}
        initialSource={currentEpisode?.embedUrl ? 'anime_episodes' : item.kodikLink ? 'anime.kodik_link' : null}
        historyItem={{ slug:item.slug, title, poster:item.poster, banner:item.banner || item.poster, rating:item.rating || item.score, meta:item.meta }}
      />
      <WatchTracker item={{ slug:item.slug, title, poster:item.poster, banner:item.banner || item.poster, rating:item.rating || item.score, meta:item.meta }} episode={currentEpisodeNumber}/>
    </section>

    <section className="compact-episodes" id="episodes">
      <div className="compact-section-head"><h2>Серии</h2><a href="#player">К плееру ↑</a></div>
      <div>
        {episodes.slice(0,32).map((e,index)=>{
          const number = Number(e.episodeNumber || index + 1)
          const active = number === currentEpisodeNumber
          return <Link className={active ? 'active' : ''} href={`?episode=${number}#player`} key={`${e.episodeNumber}-${e.voice || 'default'}`}><span>Серия {number}</span>{active?<em>сейчас</em>:<em>{e.voice || 'Kodik'}</em>}</Link>
        })}
      </div>
    </section>

    <section className="compact-similar compact-ai-recs">
      <div className="compact-section-head"><h2>Похожие тайтлы</h2><Link href={`/ai?similar=${item.slug}`}>Ещё через AI ›</Link></div>
      <div>
        {similar.map(a=><Link href={`/anime/${a.slug}`} key={a.slug}>
          <img loading="lazy" decoding="async" src={a.poster} alt={a.title}/>
          <b>{a.title}</b>
          <span>{a.meta}</span>
        </Link>)}
      </div>
    </section>

    <section className="compact-comments">
      <div className="compact-section-head"><h2>Комментарии</h2><a href="#player">К просмотру ↑</a></div>
      <CommentsClient slug={item.slug} title={title}/>
    </section>
  </main>
}
