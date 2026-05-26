import { getAnimeBySlugFromRepo, getEpisodesBySlug } from '@/lib/animeRepository'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { hasKodik, resolveKodikEpisodeRowsForAnime } from '@/lib/kodik'

export const dynamic = 'force-dynamic'

function json(payload, status = 200){
  return Response.json(payload, {
    status,
    headers:{
      'Cache-Control':'no-store, max-age=0',
      'x-aianime-player-options':'enabled'
    }
  })
}

function rowToOption(row){
  const raw = row.raw || {}
  return {
    id: row.id || `${row.animeSlug || row.anime_slug}-${row.voice}-${row.episodeNumber || row.episode_number}`,
    animeSlug: row.animeSlug || row.anime_slug,
    episodeNumber: Number(row.episodeNumber || row.episode_number || 1),
    title: row.title || `Серия ${row.episodeNumber || row.episode_number || 1}`,
    provider: row.provider || 'kodik',
    voice: row.voice || raw?.translation_title || 'Kodik',
    embedUrl: row.embedUrl || row.embed_url || null,
    status: row.status || 'published',
    source: row.source || raw?.source || 'anime_episodes',
    quality: row.quality || raw?.quality || null,
    translationType: row.translationType || raw?.translation_type || null,
    translationId: row.translationId || raw?.translation_id || null,
    seasonNumber: row.seasonNumber || raw?.season_number || null,
    episodesCount: Number(raw?.episodes_count || raw?.last_episode || 0) || null,
    materialType: raw?.material_type || null,
    matchScore: Number(raw?.match_score || 0) || null,
    reliableId: Boolean(raw?.reliable_id),
    updatedAt: row.updatedAt || row.updated_at || null
  }
}


function normalizeText(value){
  return String(value || '').toLowerCase().replace(/ё/g, 'е')
}

function isMovieAnime(item = {}){
  const kind = normalizeText(item?.kind || item?.type || item?.kodikType)
  const text = normalizeText([item?.slug, item?.title, item?.titleRu, item?.originalTitle, item?.englishTitle].filter(Boolean).join(' '))
  const episodes = Number(item?.episodes || item?.episodesCount || 0)
  if(kind === 'movie' || kind === 'film' || kind === 'anime-movie') return true
  if(/\b(movie|film)\b|фильм|кино/.test(text)) return true
  return episodes === 1 && (/\b(movie|film)\b|фильм/.test(text))
}

function isSerialOption(option = {}){
  const url = String(option?.embedUrl || '').toLowerCase()
  const type = String(option?.materialType || '').toLowerCase()
  return type.includes('serial') || /\/(serial|seria)\//i.test(url)
}

function isMovieOption(option = {}){
  const url = String(option?.embedUrl || '').toLowerCase()
  const type = String(option?.materialType || '').toLowerCase()
  return type === 'anime' || type === 'movie' || /\/(video|movie)\//i.test(url)
}

function countFromText(text){
  const normalized = normalizeText(text).replace(/[^a-zа-я0-9]+/gi, ' ').replace(/\s+/g, ' ').trim()
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

function expectedEpisodes(item = {}){
  const n = Number(item?.episodes || item?.episodesCount || item?.episodesList?.length || 0)
  if(Number.isFinite(n) && n > 0) return Math.floor(n)
  return countFromText(titleText(item))
}

function titleText(item = {}){
  return normalizeText([item?.kind, item?.type, item?.kodikType, item?.slug, item?.title, item?.titleRu, item?.originalTitle, item?.englishTitle, item?.description, item?.descriptionRu].filter(Boolean).join(' '))
}

function hasSeasonMarker(text){
  return /(?:season|сезон|tv|тв)\s*\d|(?:part|часть|cour)\s*\d|\b\d+(?:st|nd|rd|th)\s+season\b|\bs\d+\b|\bp\d+\b/.test(String(text || ''))
}

function hasSpecialMarker(text){
  return /\bova\b|\bona\b|special|спешл|спец|kuinaki|sentaku|regrets|movie|film|фильм|lost\s+girls|no\s+regrets|выбор\s+без\s+сожалений/.test(String(text || ''))
}

function optionEpisodeMismatch(option = {}, item = {}){
  const expected = expectedEpisodes(item)
  const actual = Number(option?.episodesCount || 0) || 0
  const text = titleText(item)
  const specialLike = hasSpecialMarker(text) || /ova|ona|special/.test(String(item?.kind || item?.type || '').toLowerCase())
  const seasonLike = hasSeasonMarker(text)

  if(!expected && specialLike && actual > 6) return true
  if(!expected || !actual) return false

  if(expected <= 6 && actual > expected) return true
  if(specialLike && expected <= 12 && actual > expected) return true
  if(seasonLike && expected >= 7 && expected <= 64 && actual > expected) return true
  if(expected <= 3 && isSerialOption(option) && actual >= 8) return true

  return false
}

function strictEpisodeTolerance(item = {}){
  const text = titleText(item)
  if(hasSpecialMarker(text)) return 1
  if(hasSeasonMarker(text)) return 1
  return 6
}

function isStrictEpisodeContext(item = {}){
  const expected = expectedEpisodes(item)
  const text = titleText(item)
  return Boolean(expected && (hasSpecialMarker(text) || hasSeasonMarker(text) || expected <= 12))
}

function groupConfidence(group = []){
  const reliable = group.some(row => Boolean(row?.reliableId))
  const maxScore = Math.max(...group.map(row => Number(row?.matchScore || 0)), 0)
  const onlyFallback = group.every(row => row?.source === 'anime.kodik_link' || row?.source === 'fallback')
  return { reliable, maxScore, onlyFallback, low:!reliable && maxScore < 160 }
}

function filterVoiceGroupsByExpectedCount(rows = [], item = {}){
  const expected = expectedEpisodes(item)
  if(!expected) return rows

  const strict = isStrictEpisodeContext(item)
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
    const declared = Math.max(...group.map(row => Number(row.episodesCount || 0)).filter(Boolean), 0)
    const actual = Math.max(maxEpisode, declared)
    const confidence = groupConfidence(group)

    // Для Season/Part/OVA/коротких тайтлов не допускаем voice-группу длиннее самого тайтла.
    // Так Season 3 Part 2 на 10 серий не получает Season 3 на 25 серий.
    if(actual && actual > expected) continue

    // Не принимаем слабые частичные совпадения соседних сезонов.
    // Пример: страница Season 3 Part 2 ожидает 10 серий, а Kodik отдаёт Season 4 на 2 серии
    // с reliable_id=false и низким score. Такая группа не должна появляться рядом с правильным сезоном.
    if(actual && actual < expected && confidence.low) continue

    // Для OVA/спешлов и коротких отдельных релизов нельзя пропускать слабые группы даже если
    // количество серий совпало. Иначе к OVA на 2 серии может подмешаться другой спецвыпуск
    // той же франшизы: тоже 2 серии, но reliable_id=false и matchScore около 30-40.
    if(expected <= 6 && confidence.low) continue

    // Для строгих страниц в целом оставляем только уверенные совпадения. Это не ломает
    // нормальные сезоны/части, где Kodik даёт reliable_id=true и высокий matchScore, но
    // убирает соседние сезоны/спешлы той же франшизы.
    if(strict && confidence.low) continue

    // Для строгих страниц не показываем чистый fallback из anime.kodik_link как отдельную группу.
    // Лучше пусто/меньше озвучек, чем подмешать старый serial-link от соседнего сезона.
    if(confidence.onlyFallback) continue

    allowed.push(...group)
  }
  return allowed
}

function usable(option){
  const url = String(option?.embedUrl || '').trim()
  if(!url) return false
  if(option?.status === 'placeholder') return false
  if(option?.source === 'fallback') return false
  return true
}

function hasNativeEpisodeLinks(options){
  const valid = options.filter(usable)
  if(valid.length < 2) return false
  const uniqueUrls = new Set(valid.map(item => String(item.embedUrl || '').trim()).filter(Boolean))
  const uniqueEpisodes = new Set(valid.map(item => Number(item.episodeNumber || 1)))
  // Озвучки с одной базовой serial-ссылкой — это ещё не родной список серий.
  // Родной список включаем только когда Kodik реально отдал разные episode-ссылки.
  return uniqueUrls.size > 1 && uniqueEpisodes.size > 1
}

function filterOptionsForAnime(options, item){
  const valid = (Array.isArray(options) ? options : []).filter(usable)
  if(!valid.length) return []

  const expectedEpisodes = Number(item?.episodes || item?.episodesList?.length || 0) || 0
  const movieAnime = isMovieAnime(item)
  const isSerialAnime = !movieAnime && (expectedEpisodes > 1 || String(item?.kind || '').toLowerCase() !== 'movie')
  const hasSerialLinks = valid.some(option => isSerialOption(option))

  let rows = valid
  const strictContext = isStrictEpisodeContext(item)

  // На Season/Part/OVA/Movie-страницах не смешиваем старый anime.kodik_link с настоящими
  // episode-ссылками Kodik. Старый fallback часто ведёт на соседний сезон франшизы.
  if(strictContext && rows.some(option => option.source === 'kodik-api-episode')){
    rows = rows.filter(option => option.source !== 'anime.kodik_link')
  }

  // Если страница — фильм, не показываем найденный Kodik-сериал. Лучше честно показать,
  // что плеера пока нет, чем включить другой тайтл/TV-сезон.
  if(movieAnime){
    rows = rows.filter(option => isMovieOption(option) && !isSerialOption(option))
  }else if(isSerialAnime && hasSerialLinks){
    rows = rows.filter(option => {
      const url = String(option.embedUrl || '')
      const type = String(option.materialType || '')
      if(/\/serial\//i.test(url) || type.includes('serial')) return true
      // Если это настоящая episode-ссылка, она тоже годится.
      if(option.source === 'kodik-api-episode' && option.episodeNumber > 1) return true
      return false
    })
  }

  // Не отдаём OVA/спешлу/конкретному сезону плееры от базового TV-сериала с другим количеством серий.
  rows = rows.filter(option => !optionEpisodeMismatch(option, item))

  // Старые строки, найденные только по названию с низким score, часто дают мусорные озвучки от похожих тайтлов.
  rows = rows.filter(option => {
    if(option.source === 'anime.kodik_link') return true
    if(option.source === 'kodik-api-episode') return true
    if(option.reliableId) return true
    if(Number(option.matchScore || 0) >= 160) return true
    return false
  })

  rows = filterVoiceGroupsByExpectedCount(rows, item)

  const best = new Map()
  for(const option of rows){
    const key = `${option.provider}:${option.voice}:${option.episodeNumber}`
    const current = best.get(key)
    const score = (option.source === 'kodik-api-episode' ? 100 : 0)
      + (option.reliableId ? 60 : 0)
      + (Number(option.matchScore || 0) / 10)
      + (/\/serial\//i.test(String(option.embedUrl || '')) ? 10 : 0)
    const currentScore = current?.__score ?? -1
    if(!current || score >= currentScore) best.set(key, { ...option, __score:score })
  }

  return Array.from(best.values()).map(({ __score, ...option }) => option)
}


function buildOptionsAudit(options = [], item = {}){
  const rows = Array.isArray(options) ? options : []
  const expected = expectedEpisodes(item)
  const voices = new Map()

  for(const option of rows){
    const voice = option?.voice || 'Kodik'
    if(!voices.has(voice)){
      voices.set(voice, {
        voice,
        count:0,
        min:null,
        max:null,
        declaredMax:0,
        episodes:[],
        sources:new Set(),
        materialTypes:new Set(),
        reliable:false,
        maxScore:0
      })
    }
    const bucket = voices.get(voice)
    const episode = Number(option?.episodeNumber || 0)
    const declared = Number(option?.episodesCount || 0)
    bucket.count += 1
    bucket.reliable = bucket.reliable || Boolean(option?.reliableId)
    bucket.maxScore = Math.max(bucket.maxScore, Number(option?.matchScore || 0))
    if(episode){
      bucket.min = bucket.min === null ? episode : Math.min(bucket.min, episode)
      bucket.max = bucket.max === null ? episode : Math.max(bucket.max, episode)
      bucket.episodes.push(episode)
    }
    if(declared) bucket.declaredMax = Math.max(bucket.declaredMax, declared)
    if(option?.source) bucket.sources.add(option.source)
    if(option?.materialType) bucket.materialTypes.add(option.materialType)
  }

  const voiceRows = Array.from(voices.values()).map(bucket => {
    const uniqueEpisodes = Array.from(new Set(bucket.episodes)).sort((a,b) => a-b)
    return {
      voice:bucket.voice,
      count:uniqueEpisodes.length,
      rows:bucket.count,
      min:bucket.min,
      max:bucket.max,
      declaredMax:bucket.declaredMax || null,
      overExpected:Boolean(expected && Math.max(bucket.max || 0, bucket.declaredMax || 0) > expected),
      episodes:uniqueEpisodes.slice(0, 80),
      reliable:bucket.reliable,
      maxScore:bucket.maxScore || null,
      weak:!bucket.reliable && (bucket.maxScore || 0) < 160,
      sources:Array.from(bucket.sources),
      materialTypes:Array.from(bucket.materialTypes)
    }
  }).sort((a,b) => (b.count - a.count) || String(a.voice).localeCompare(String(b.voice)))

  return {
    expectedEpisodes:expected || null,
    animeType:item?.type || item?.kind || item?.kodikType || null,
    title:item?.titleRu || item?.title || item?.slug || null,
    totalOptions:rows.length,
    nativeEpisodeLinks:hasNativeEpisodeLinks(rows),
    voices:voiceRows,
    warnings:voiceRows
      .filter(row => row.overExpected)
      .map(row => `${row.voice}: max ${Math.max(row.max || 0, row.declaredMax || 0)} > expected ${expected}`)
  }
}

async function saveRows(rows){
  if(!hasSupabase() || !rows.length) return { ok:false, saved:0, skipped:true }
  const res = await supabaseRequest('anime_episodes?on_conflict=anime_slug,episode_number,provider,voice', {
    method:'POST',
    body: JSON.stringify(rows),
    headers:{ Prefer:'resolution=merge-duplicates,return=representation' },
    timeout:25000
  })
  if(!res.ok){
    const text = await res.text().catch(() => '')
    return { ok:false, saved:0, error:text || `Supabase ${res.status}` }
  }
  const saved = await res.json().catch(() => [])
  return { ok:true, saved:Array.isArray(saved) ? saved.length : rows.length }
}

async function handleGET(req){
  const url = new URL(req.url)
  const slug = String(url.searchParams.get('slug') || '').trim()
  const refresh = url.searchParams.get('refresh') === '1'
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 40), 5), 80)
  const debug = url.searchParams.get('debug') === '1'

  if(!slug) return json({ ok:false, error:'slug is required' }, 400)

  const item = await getAnimeBySlugFromRepo(slug)
  if(!item) return json({ ok:false, error:'anime not found' }, 404)

  const existingEpisodes = await getEpisodesBySlug(slug, item.episodes || item.episodesList?.length || 1)
  const existingOptions = filterOptionsForAnime(existingEpisodes.map(rowToOption), item)

  if(!refresh && hasNativeEpisodeLinks(existingOptions)){
    return json({ ok:true, source:'anime_episodes', slug, options:existingOptions, saved:0, refreshed:false, ...(debug ? { audit:buildOptionsAudit(existingOptions, item) } : {}) })
  }

  if(!hasKodik()){
    return json({ ok:true, source:'anime_episodes', slug, options:existingOptions, saved:0, refreshed:false, warning:'KODIK_TOKEN is not configured', ...(debug ? { audit:buildOptionsAudit(existingOptions, item) } : {}) })
  }

  try{
    const rows = await resolveKodikEpisodeRowsForAnime({
      slug:item.slug,
      title:item.title,
      title_ru:item.titleRu,
      original_title:item.originalTitle,
      shikimoriId:item.shikimoriId || item.malId || null,
      malId:item.malId || null,
      year:item.year,
      episodes:item.episodes || item.episodesList?.length || 1,
      description:item.description,
      descriptionRu:item.descriptionRu
    }, { limit, withEpisodes:true, withEpisodesData:true, minScore:22, maxEpisodes:800 })

    const saved = await saveRows(rows)
    const nextOptions = rows.length ? filterOptionsForAnime(rows.map(rowToOption), item) : existingOptions
    return json({
      ok:true,
      source:rows.length ? 'kodik-api' : 'anime_episodes',
      slug,
      options:nextOptions,
      found:rows.length,
      saved:saved.saved || 0,
      save:saved,
      refreshed:true,
      ...(debug ? { audit:buildOptionsAudit(nextOptions, item) } : {})
    })
  }catch(error){
    return json({
      ok:true,
      source:'anime_episodes',
      slug,
      options:existingOptions,
      saved:0,
      refreshed:false,
      warning:error?.message || String(error),
      ...(debug ? { audit:buildOptionsAudit(existingOptions, item) } : {})
    })
  }
}


export async function GET(req){
  try{
    return await handleGET(req)
  }catch(error){
    return json({
      ok:false,
      source:'player-options-route',
      error:'player options route failed',
      details:error?.message || String(error),
      stack: process.env.NODE_ENV === 'production' ? undefined : error?.stack
    }, 500)
  }
}
