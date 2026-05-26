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



function normalizeKindText(value){
  return String(value || '').toLowerCase().replace(/ё/g, 'е')
}

function isMovieAnime(item = {}){
  const kind = normalizeKindText(item?.kind || item?.kodikType)
  const text = normalizeKindText([item?.slug, item?.title, item?.titleRu, item?.originalTitle, item?.englishTitle].filter(Boolean).join(' '))
  const episodes = Number(item?.episodes || 0)
  if(kind === 'movie' || kind === 'film' || kind === 'anime-movie') return true
  if(/\b(movie|film)\b|фильм|кино/.test(text)) return true
  return episodes === 1 && (/\b(movie|film)\b|фильм/.test(text))
}

function isSerialPlayerUrl(value){
  return /\/(serial|seria)\//i.test(String(value || ''))
}

function isMoviePlayerUrl(value){
  return /\/(video|movie)\//i.test(String(value || ''))
}

function titleEpisodeText(item = {}){
  return normalizeKindText([item?.kind, item?.type, item?.kodikType, item?.slug, item?.title, item?.titleRu, item?.originalTitle, item?.englishTitle, item?.description, item?.descriptionRu].filter(Boolean).join(' '))
}

function textEpisodeCount(text){
  const normalized = normalizeKindText(text).replace(/[^a-zа-я0-9]+/gi, ' ').replace(/\s+/g, ' ').trim()
  const patterns = [
    /(?:в сезоне указано|указано|сезоне|сезон)\s*(\d{1,3})\s*(?:сер|серии|серий|эп|эпизод)/i,
    /(\d{1,3})\s*(?:серия|серии|серий|эпизод|эпизода|эпизодов)/i,
    /(?:ova|она|special|спешл)\s*(\d{1,3})/i,
  ]
  for(const pattern of patterns){
    const match = normalized.match(pattern)
    const n = Number(match?.[1])
    if(Number.isFinite(n) && n > 0 && n < 500) return Math.floor(n)
  }
  return 0
}

function hasSpecialTitleMarker(text){
  return /\bova\b|\bona\b|special|спешл|спец|kuinaki|sentaku|regrets|movie|film|фильм|lost\s+girls|no\s+regrets|выбор\s+без\s+сожалений/.test(String(text || ''))
}

function hasSeasonTitleMarker(text){
  const value = String(text || '')
  return /(?:season|сезон|tv|тв|сезон|тв)[\s._:-]*\d|(?:part|часть|cour)[\s._:-]*\d|\b\d+(?:st|nd|rd|th)[\s._:-]+season\b|\bs\d+\b|\bp\d+\b|\bthe[\s._:-]*final\b|\bfinal\s*season\b|финал|финальный|заключительный/.test(value)
}

function strictEpisodeTolerance(item = {}){
  const text = titleEpisodeText(item)
  if(hasSpecialTitleMarker(text)) return 1
  if(hasSeasonTitleMarker(text)) return 1
  return 6
}

function expectedEpisodeCount(item = {}){
  const text = titleEpisodeText(item)
  const parsed = textEpisodeCount(text)
  if(parsed && hasSpecialTitleMarker(text)) return parsed
  const dbCount = Number(item?.episodes || item?.episodesCount || item?.episodesList?.length || 0)
  if(Number.isFinite(dbCount) && dbCount > 0) return Math.floor(dbCount)
  return parsed
}

function clampRowsToExpectedEpisodes(rows = [], item = {}){
  const expected = expectedEpisodeCount(item)
  if(!expected || expected <= 1 || expected > 64) return rows
  // Kodik часто добавляет бонусную OVA/спешл как 25-ю серию к TV-сезону на 24 серии.
  // Для страницы самого тайтла показываем только официальное количество серий из нашей базы.
  return (Array.isArray(rows) ? rows : []).filter(row => {
    const episode = Number(row?.episodeNumber || 0)
    if(!episode) return true
    return episode <= expected
  })
}

function optionEpisodeMismatch(option = {}, item = {}){
  const actual = Number(option?.episodesCount || option?.raw?.episodes_count || option?.raw?.last_episode || 0) || 0
  const expected = expectedEpisodeCount(item)
  const text = titleEpisodeText(item)
  const specialLike = hasSpecialTitleMarker(text) || /ova|ona|special/.test(String(item?.kind || item?.type || '').toLowerCase())
  const seasonLike = hasSeasonTitleMarker(text)
  if(!expected && specialLike && actual > 6) return true
  if(!expected || !actual) return false
  if(expected <= 6 && actual > expected) return true
  if(specialLike && expected <= 12 && actual > expected) return true
  if(seasonLike && expected >= 7 && expected <= 64 && actual > expected) return true
  if(expected >= 7 && expected <= 64 && actual > expected + strictEpisodeTolerance(item)) return true
  return false
}

function filterVoiceGroupsByExpectedCount(rows = [], item = {}){
  const expected = expectedEpisodeCount(item)
  if(!expected) return rows
  rows = clampRowsToExpectedEpisodes(rows, item)

  const text = titleEpisodeText(item)
  const strict = hasSpecialTitleMarker(text) || hasSeasonTitleMarker(text) || expected <= 64
  if(!strict) return rows

  const byVoice = new Map()
  for(const row of rows){
    const key = `${row.provider || 'kodik'}:${row.voice || 'Kodik'}`
    if(!byVoice.has(key)) byVoice.set(key, [])
    byVoice.get(key).push(row)
  }

  const allowed = []
  for(const group of byVoice.values()){
    const episodeNumbers = group.map(row => Number(row.episodeNumber || 0)).filter(Boolean)
    const maxEpisode = episodeNumbers.length ? Math.max(...episodeNumbers) : 0
    const declared = Math.max(...group.map(row => Number(row.episodesCount || row.raw?.episodes_count || 0)).filter(Boolean), 0)
    // Если есть реальные episode-ссылки, доверяем maxEpisode, а не declared episodes_count.
    // declared может включать бонусный спецвыпуск 25 к сериалу на 24 серии.
    const actual = maxEpisode || declared
    if(actual && actual > expected + strictEpisodeTolerance(item)) continue
    allowed.push(...group)
  }
  return allowed
}


function groupConfidence(group = []){
  const reliable = group.some(row => Boolean(row?.raw?.reliable_id || row?.reliableId))
  const maxScore = Math.max(...group.map(row => Number(row?.raw?.match_score || row?.matchScore || 0)), 0)
  const onlyFallback = group.every(row => row?.source === 'anime.kodik_link' || row?.source === 'fallback')
  return { reliable, maxScore, onlyFallback, low:!reliable && maxScore < 160 }
}

function filterIncompleteAndPlayerOnlyVoiceGroups(rows = [], item = {}){
  const list = clampRowsToExpectedEpisodes(Array.isArray(rows) ? rows : [], item)
  if(list.length <= 1) return list

  const expected = expectedEpisodeCount(item)
  const text = titleEpisodeText(item)
  const strict = hasSpecialTitleMarker(text) || hasSeasonTitleMarker(text) || Boolean(expected && expected <= 64)
  const byVoice = new Map()

  for(const row of list){
    const key = `${row.provider || 'kodik'}:${row.voice || 'Kodik'}`
    if(!byVoice.has(key)) byVoice.set(key, [])
    byVoice.get(key).push(row)
  }

  const groups = Array.from(byVoice.values()).map(group => {
    const episodes = Array.from(new Set(group.map(row => Number(row?.episodeNumber || 0)).filter(Boolean))).sort((a,b) => a-b)
    const urls = new Set(group.map(row => String(row?.embedUrl || '').trim()).filter(Boolean))
    const hasNativeRows = group.some(row => row?.source === 'kodik-api-episode' || row?.source === 'kodik-api-season-episode')
    const nativeEpisodeLinks = hasNativeRows && episodes.length > 1 && urls.size > 1
    const completeByExpected = expected > 1
      && episodes.length === expected
      && episodes[0] === 1
      && episodes.includes(expected)
      && episodes.every((episode, index) => episode === index + 1)
    const confidence = groupConfidence(group)
    return { group, episodes, nativeEpisodeLinks, completeByExpected, confidence }
  })

  const hasAnyNativeEpisodeGroup = groups.some(info => info.nativeEpisodeLinks)
  let keep = groups

  if(hasAnyNativeEpisodeGroup){
    keep = keep.filter(info => info.nativeEpisodeLinks || info.episodes.length > 1)
  }

  const completeGroups = keep.filter(info => info.completeByExpected)
  if(expected > 1 && completeGroups.length){
    keep = completeGroups
  }else if(!expected && keep.length > 1){
    const bestCount = Math.max(...keep.map(info => info.episodes.length), 0)
    if(bestCount >= 4){
      keep = keep.filter(info => info.episodes.length >= Math.ceil(bestCount * 0.8))
    }
  }

  const hasReliable = keep.some(info => info.confidence.reliable || info.confidence.maxScore >= 160)
  if(strict && hasReliable){
    keep = keep.filter(info => info.confidence.reliable || info.confidence.maxScore >= 160)
  }

  return keep.flatMap(info => info.group)
}

function isSerialPlayerOption(option = {}){
  const type = String(option?.materialType || option?.raw?.material_type || '').toLowerCase()
  return type.includes('serial') || isSerialPlayerUrl(option?.embedUrl)
}

function isMoviePlayerOption(option = {}){
  const type = String(option?.materialType || option?.raw?.material_type || '').toLowerCase()
  return type === 'anime' || type === 'movie' || isMoviePlayerUrl(option?.embedUrl)
}

function canUseStoredKodikLink(item = {}){
  const url = String(item?.kodikLink || '').trim()
  if(!url) return false
  if(isMovieAnime(item)) return isMoviePlayerUrl(url) && !isSerialPlayerUrl(url)

  // Для OVA/Season/Part страниц одиночная kodik_link слишком часто ведёт на соседний сезон.
  // Используем только проверенные anime_episodes после фильтрации.
  const text = titleEpisodeText(item)
  if(hasSpecialTitleMarker(text) || hasSeasonTitleMarker(text)) return false
  return true
}

function episodeVoiceLabel(value){
  const voice = String(value || '').trim()
  if(!voice || voice.toLowerCase() === 'default') return 'Kodik'
  return voice
}


function hasUsableEpisodeLink(episode){
  const embed = String(episode?.embedUrl || '').trim()
  if(!embed) return false
  if(episode?.status === 'placeholder') return false
  if(episode?.source === 'fallback') return false
  return true
}

function buildNativePlayerOptions(episodes = [], item = {}){
  const rows = (episodes || [])
    .filter(hasUsableEpisodeLink)
    .map((episode) => ({
      id: episode.id || `${episode.voice || 'kodik'}-${episode.episodeNumber}`,
      episodeNumber: Math.max(1, Number(episode?.episodeNumber || 1) || 1),
      title: episode.title || `Серия ${episode.episodeNumber || 1}`,
      provider: episode.provider || 'kodik',
      voice: episodeVoiceLabel(episode?.voice),
      embedUrl: String(episode?.embedUrl || '').trim(),
      status: episode.status || 'published',
      source: episode.source || 'anime_episodes',
      quality: episode.quality || episode.raw?.quality || null,
      translationType: episode.translationType || episode.raw?.translation_type || null,
      translationId: episode.translationId || episode.raw?.translation_id || null,
      seasonNumber: episode.seasonNumber || episode.raw?.season_number || null,
      episodesCount: Number(episode.episodesCount || episode.raw?.episodes_count || episode.raw?.last_episode || 0) || null,
      materialType: episode.materialType || episode.raw?.material_type || null,
      raw: episode.raw || null,
      updatedAt: episode.updatedAt || null
    }))

  const guardedRows = rows.filter(row => !optionEpisodeMismatch(row, item))

  let scopedRows = isMovieAnime(item)
    ? guardedRows.filter(row => isMoviePlayerOption(row) && !isSerialPlayerOption(row))
    : guardedRows

  scopedRows = clampRowsToExpectedEpisodes(scopedRows, item)
  scopedRows = filterVoiceGroupsByExpectedCount(scopedRows, item)
  scopedRows = filterIncompleteAndPlayerOnlyVoiceGroups(scopedRows, item)

  if(!scopedRows.length) return []

  const unique = new Map()
  for(const row of scopedRows){
    const key = `${row.provider}:${row.voice}:${row.episodeNumber}`
    const current = unique.get(key)
    const score = (row.embedUrl ? 10 : 0) + (row.source === 'kodik-api-episode' ? 5 : 0) + (row.translationType === 'voice' ? 2 : 0)
    const currentScore = current ? (current.embedUrl ? 10 : 0) + (current.source === 'kodik-api-episode' ? 5 : 0) + (current.translationType === 'voice' ? 2 : 0) : -1
    if(!current || score >= currentScore) unique.set(key, row)
  }

  const cleaned = Array.from(unique.values()).sort((a,b) => {
    const voice = String(a.voice || '').localeCompare(String(b.voice || ''), 'ru')
    if(voice) return voice
    return Number(a.episodeNumber) - Number(b.episodeNumber)
  })

  // Старые строки players-sync могли создать 28 фейковых серий с одной и той же iframe-ссылкой.
  // Для родного выбора такие строки не используем как список серий: либо ждём детальные episode links,
  // либо показываем один базовый iframe и клиент сам подтянет /api/player/options?refresh=1.
  const urls = new Set(cleaned.map(row => row.embedUrl).filter(Boolean))
  const episodeNumbers = new Set(cleaned.map(row => row.episodeNumber))
  const hasDetailedEpisodes = urls.size > 1 && episodeNumbers.size > 1
  if(!hasDetailedEpisodes && cleaned.length > 1){
    return [cleaned[0]]
  }

  return cleaned
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

function getDisplayEpisodeCount(item = {}, playerOptions = []){
  const expected = expectedEpisodeCount(item)
  if(expected > 0) return expected

  const optionNumbers = new Set(
    (playerOptions || [])
      .map(option => Number(option?.episodeNumber || 0))
      .filter(number => Number.isFinite(number) && number > 0)
  )
  const maxOptionEpisode = optionNumbers.size ? Math.max(...optionNumbers) : 0

  // Для страницы тайтла нельзя использовать episodes.length: в anime_episodes лежат
  // строки "озвучка × серия", поэтому 36 озвучек × 28 серий превращались в 1000+.
  // Показываем количество реальных серий, а не количество player rows.
  if(maxOptionEpisode > 1) return maxOptionEpisode

  if(isMovieAnime(item)) return 1
  return maxOptionEpisode || ''
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
  const playerOptions = buildNativePlayerOptions(episodes, item)
  const selectedEpisodeNumber = Math.max(1, Number(resolvedSearchParams?.episode || 1) || 1)
  const selectedVoice = String(resolvedSearchParams?.voice || '').trim()
  const currentEpisode = playerOptions.find(e => selectedVoice && e.voice === selectedVoice && Number(e.episodeNumber) === selectedEpisodeNumber)
    || playerOptions.find(e => Number(e.episodeNumber) === selectedEpisodeNumber)
    || playerOptions[0]
    || null
  const storedKodikLink = canUseStoredKodikLink(item) ? item.kodikLink : null
  const currentEpisodeNumber = Number(currentEpisode?.episodeNumber || selectedEpisodeNumber || 1)
  const titleEpisodeHref = (number, voice = currentEpisode?.voice) => {
    const params = new URLSearchParams()
    params.set('episode', String(Math.max(1, Number(number) || 1)))
    if(voice) params.set('voice', voice)
    return `/anime/${encodeURIComponent(item.slug)}?${params.toString()}#player`
  }
  const similar = recommendAnime(allAnime, `похожие на ${title}`, { baseAnime: item, limit: 6 })
  const siteRating = await getSiteRatingStats(item?.slug)

  const info = visibleInfoRows([
    ['Статус', statusLabel(item.status)],
    ['Тип', item.kind === 'movie' ? 'Фильм' : 'Сериал'],
    ['Год выхода', item.year || '—'],
    ['Возрастной рейтинг', item.ageRating || '16+'],
    ['Первоисточник', item.source || 'Манга / оригинал'],
    ['Студия', item.studio || '—'],
    ['Режиссёр', item.director || 'Будет добавлено'],
    ['Количество серий', getDisplayEpisodeCount(item, playerOptions)],
    ['Перевод', item.translationTitle || 'Kodik / будет добавлено'],
    ['Озвучка', currentEpisode?.voice || item.translationTitle || 'Kodik'],
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

        <div className="compact-rating-row" aria-label="Рейтинг AIanime и внешние ссылки">
          <div className="main-rate site-rate" title={siteRating.count ? `Средняя оценка пользователей AIanime: ${siteRating.count}` : 'Оценок пользователей AIanime пока нет'}><b>{ratingLabel(siteRating.value)}</b><span>{siteRating.count ? `${siteRating.count} оценок` : 'наш рейтинг'}</span></div>
          <a className="rate-chip shiki is-link" href={externalSearchUrl('shiki', item)} target="_blank" rel="noopener noreferrer" title="Открыть тайтл на Shikimori">Shiki ↗</a>
          <Link className="rate-chip ai is-link" href={`/ai?similar=${item.slug}`} title="Найти похожие тайтлы через AI">AI-похожие</Link>
          <a className="rate-chip mal is-link" href={externalSearchUrl('mal', item)} target="_blank" rel="noopener noreferrer" title="Открыть тайтл на MyAnimeList">MAL ↗</a>
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
      <div className="compact-section-head"><h2>Плеер</h2><span className="compact-player-hint">Озвучки и серии</span></div>
      <KodikPlayerClient
        slug={item.slug}
        title={title}
        banner={item.banner || item.poster}
        episode={currentEpisodeNumber}
        selectedVoice={currentEpisode?.voice || selectedVoice || item.translationTitle || 'Kodik'}
        voice={currentEpisode?.voice || item.translationTitle || 'Kodik'}
        translationTitle={item.translationTitle}
        quality={currentEpisode?.quality || item.quality}
        playerOptions={playerOptions}
        initialEmbedUrl={currentEpisode?.embedUrl || storedKodikLink || null}
        initialVoice={currentEpisode?.voice || item.translationTitle || null}
        initialQuality={currentEpisode?.quality || item.quality || null}
        initialSource={currentEpisode?.embedUrl ? currentEpisode.source || 'anime_episodes' : storedKodikLink ? 'anime.kodik_link' : null}
        historyItem={{ slug:item.slug, title, poster:item.poster, banner:item.banner || item.poster, rating:item.rating || item.score, meta:item.meta }}
      />
      <WatchTracker item={{ slug:item.slug, title, poster:item.poster, banner:item.banner || item.poster, rating:item.rating || item.score, meta:item.meta, voice:currentEpisode?.voice || item.translationTitle || 'Kodik' }} episode={currentEpisodeNumber}/>
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
