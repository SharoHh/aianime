export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAnimeList, getAnimeBySlugFromRepo, getEpisodesBySlug } from '@/lib/animeRepository'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
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



async function fetchJsonSoft(url, options = {}){
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = setTimeout(() => {
    try{ controller?.abort() }catch{}
  }, Number(options.timeout || 2200))
  try{
    const res = await fetch(url, {
      cache:'force-cache',
      next:{ revalidate:Number(options.revalidate || 21600) },
      headers: options.headers || {},
      signal: controller?.signal
    })
    if(!res.ok) return null
    return await res.json()
  }catch{
    return null
  }finally{
    clearTimeout(timer)
  }
}

async function getSiteRatingStats(slug){
  if(!hasSupabase() || !slug) return { value:null, count:0 }
  try{
    const res = await supabaseRequest(`user_ratings?select=rating&anime_slug=eq.${encodeURIComponent(slug)}&limit=1000`, { method:'GET', timeout:2200 })
    if(!res.ok) return { value:null, count:0 }
    const rows = await res.json()
    if(!Array.isArray(rows) || !rows.length) return { value:null, count:0 }
    const values = rows.map(row => Number(row.rating)).filter(value => Number.isFinite(value) && value > 0)
    if(!values.length) return { value:null, count:0 }
    const average = values.reduce((sum, value) => sum + value, 0) / values.length
    return { value:average, count:values.length }
  }catch{
    return { value:null, count:0 }
  }
}

function externalQuery(item){
  return String(item?.englishTitle || item?.originalTitle || item?.title || item?.slug || 'anime').trim()
}

function scoreNumber(value){
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

async function fetchMalRating(item){
  const malId = Number(item?.malId || item?.shikimoriId || 0)
  if(Number.isFinite(malId) && malId > 0){
    const data = await fetchJsonSoft(`https://api.jikan.moe/v4/anime/${malId}`, { timeout:2500, revalidate:21600 })
    const score = scoreNumber(data?.data?.score)
    if(score) return score
  }

  const query = encodeURIComponent(externalQuery(item))
  const data = await fetchJsonSoft(`https://api.jikan.moe/v4/anime?q=${query}&limit=1`, { timeout:2500, revalidate:21600 })
  return scoreNumber(data?.data?.[0]?.score)
}

async function fetchShikiRating(item){
  // В текущей базе shikimori_id часто используется как legacy MAL id.
  // Поэтому Shikimori не берём по этому id, а ищем тайтл на стороне Shikimori.
  const query = encodeURIComponent(externalQuery(item))
  const rows = await fetchJsonSoft(`https://shikimori.one/api/animes?search=${query}&limit=5`, {
    timeout:2500,
    revalidate:21600,
    headers:{ 'User-Agent':'AIanime/1.0 (+https://aianime.ru)' }
  })
  if(!Array.isArray(rows) || !rows.length) return null

  const malId = Number(item?.malId || item?.shikimoriId || 0)
  const byMal = rows.find(row => Number(row?.mal_id) === malId || Number(row?.id) === Number(item?.shikimoriId || 0))
  const picked = byMal || rows[0]
  return scoreNumber(picked?.score)
}

async function getExternalRatings(item){
  const [mal, shiki, site] = await Promise.all([
    fetchMalRating(item),
    fetchShikiRating(item),
    getSiteRatingStats(item?.slug)
  ])
  return { site, mal, shiki }
}

function ratingLabel(value){
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number.toFixed(1) : '—'
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


function episodeVoiceLabel(value){
  const voice = String(value || '').trim()
  if(!voice || voice.toLowerCase() === 'default') return 'Kodik'
  return voice
}

function buildEpisodeOptions(episodes = []){
  const byNumber = new Map()
  for(const episode of episodes || []){
    const number = Math.max(1, Number(episode?.episodeNumber || 0) || 1)
    const current = byNumber.get(number)
    const candidate = { ...episode, episodeNumber:number, voice:episodeVoiceLabel(episode?.voice) }
    if(!current){
      byNumber.set(number, candidate)
      continue
    }

    const candidateScore = (candidate.embedUrl ? 10 : 0) + (String(candidate.voice || '').toLowerCase() !== 'kodik' ? 2 : 0) + (candidate.status === 'published' ? 1 : 0)
    const currentScore = (current.embedUrl ? 10 : 0) + (String(current.voice || '').toLowerCase() !== 'kodik' ? 2 : 0) + (current.status === 'published' ? 1 : 0)
    if(candidateScore > currentScore) byNumber.set(number, candidate)
  }

  return Array.from(byNumber.values()).sort((a,b) => Number(a.episodeNumber) - Number(b.episodeNumber))
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
  const episodeOptions = buildEpisodeOptions(episodes)
  const selectedEpisodeNumber = Math.max(1, Number(resolvedSearchParams?.episode || 1) || 1)
  const currentEpisode = episodeOptions.find(e => Number(e.episodeNumber) === selectedEpisodeNumber) || episodeOptions[0] || episodes[0]
  const currentEpisodeNumber = Number(currentEpisode?.episodeNumber || selectedEpisodeNumber || 1)
  const nextEpisode = episodeOptions.find(e => Number(e.episodeNumber) > currentEpisodeNumber) || null
  const titleEpisodeHref = (number) => `/anime/${encodeURIComponent(item.slug)}?episode=${Math.max(1, Number(number) || 1)}#player`
  const similar = recommendAnime(allAnime, `похожие на ${title}`, { baseAnime: item, limit: 6 })
  const externalRatings = await getExternalRatings(item)

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
          <div className="main-rate site-rate" title={externalRatings.site.count ? `Средняя оценка пользователей AIanime: ${externalRatings.site.count}` : 'Оценок пользователей AIanime пока нет'}><b>{ratingLabel(externalRatings.site.value)}</b><span>{externalRatings.site.count ? `${externalRatings.site.count} оценок` : 'наш рейтинг'}</span></div>
          <a className="rate-chip shiki is-link" href={externalSearchUrl('shiki', item)} target="_blank" rel="noopener noreferrer" title="Открыть тайтл на Shikimori">Shiki {ratingLabel(externalRatings.shiki)}</a>
          <Link className="rate-chip ai is-link" href={`/ai?similar=${item.slug}`} title="Найти похожие тайтлы через AI">AI {aiMatchPercent(item)}</Link>
          <a className="rate-chip mal is-link" href={externalSearchUrl('mal', item)} target="_blank" rel="noopener noreferrer" title="Открыть тайтл на MyAnimeList">MAL {ratingLabel(externalRatings.mal)}</a>
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
          <Link className="compact-watch" href={titleEpisodeHref(currentEpisodeNumber)}>▶ Смотреть</Link>
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

    <section className="compact-episodes episode-picker-clean" id="episodes">
      <div className="compact-section-head episode-picker-head">
        <div>
          <h2>Серии</h2>
          <p>{episodeOptions.length ? `${episodeOptions.length} серий · сейчас ${currentEpisodeNumber}` : 'Список серий обновляется'}</p>
        </div>
        <a href="#player">К плееру ↑</a>
      </div>

      {episodeOptions.length ? <div className="episode-picker-toolbar">
        <span>Выбрана серия <b>{currentEpisodeNumber}</b></span>
        {nextEpisode ? <Link href={titleEpisodeHref(nextEpisode.episodeNumber)}>Следующая серия →</Link> : <span>Последняя серия</span>}
      </div> : null}

      <div className="episode-picker-grid" aria-label="Выбор серии">
        {episodeOptions.slice(0,64).map((e)=>{
          const number = Number(e.episodeNumber || 1)
          const active = number === currentEpisodeNumber
          const voiceLabel = episodeVoiceLabel(e.voice || item.translationTitle)
          return <Link
            className={active ? 'active' : ''}
            href={titleEpisodeHref(number)}
            key={`episode-${number}`}
            prefetch={false}
            aria-current={active ? 'true' : undefined}
          >
            <span>{number}</span>
            <em>{active ? 'сейчас' : voiceLabel}</em>
          </Link>
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
