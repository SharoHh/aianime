import { getAnimeBySlugFromRepo } from '@/lib/animeRepository'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { hasKodik, normalizeKodikPlayerUrl, resolveKodikPlayerForAnime } from '@/lib/kodik'

function json(data, status = 200){
  return Response.json(data, { status })
}

function runtimeResolveEnabled(req){
  // По умолчанию player НЕ ходит во внешний Kodik на обычном рендере.
  // Автоматическая схема: cron sync-kodik сохраняет kodik_link в Supabase,
  // плеер читает готовую ссылку из базы. Runtime-resolve включается отдельно.
  return req.nextUrl.searchParams.get('resolve') === '1' || process.env.ENABLE_KODIK_PLAYER_RUNTIME === '1'
}


function normalizeText(value){
  return String(value || '').toLowerCase().replace(/ё/g, 'е')
}

function isMovieAnime(item = {}){
  const kind = normalizeText(item?.kind || item?.kodik_type || item?.kodikType)
  const text = normalizeText([item?.slug, item?.title, item?.title_ru, item?.titleRu, item?.original_title, item?.originalTitle].filter(Boolean).join(' '))
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

function expectedEpisodes(anime = {}){
  const n = Number(anime?.episodes || anime?.episodes_count || 0)
  if(Number.isFinite(n) && n > 0) return Math.floor(n)
  return countFromText(playerTitleText(anime))
}

function playerTitleText(anime = {}){
  return normalizeText([anime?.kind, anime?.kodik_type, anime?.kodikType, anime?.slug, anime?.title, anime?.title_ru, anime?.titleRu, anime?.original_title, anime?.originalTitle, anime?.description, anime?.description_ru, anime?.descriptionRu].filter(Boolean).join(' '))
}

function hasSeasonMarker(text){
  const value = String(text || '')
  return /(?:season|сезон|tv|тв|сезон|тв)[\s._:-]*\d|(?:part|часть|cour)[\s._:-]*\d|\b\d+(?:st|nd|rd|th)[\s._:-]+season\b|\bs\d+\b|\bp\d+\b|\bthe[\s._:-]*final\b|\bfinal\s*season\b|финал|финальный|заключительный/.test(value)
}

function hasSpecialMarker(text){
  return /\bova\b|\bona\b|special|спешл|спец|kuinaki|sentaku|regrets|movie|film|фильм|lost\s+girls|no\s+regrets|выбор\s+без\s+сожалений/.test(String(text || ''))
}

function strictEpisodeTolerance(anime = {}){
  const text = playerTitleText(anime)
  if(hasSpecialMarker(text)) return 1
  if(hasSeasonMarker(text)) return 1
  return 6
}

function hasStrongPlayerMarker(anime = {}){
  const text = playerTitleText(anime)
  return hasSpecialMarker(text) || hasSeasonMarker(text)
}

function episodeRowMatchesAnime(row, anime = {}){
  if(!row) return false
  const raw = row.raw || {}
  const expected = expectedEpisodes(anime)
  const actual = Number(raw.episodes_count || raw.last_episode || 0) || 0
  const text = playerTitleText(anime)
  const specialLike = hasSpecialMarker(text) || /ova|ona|special/.test(String(anime?.kind || '').toLowerCase())
  const seasonLike = hasSeasonMarker(text)

  if(!expected && specialLike && actual > 6) return false

  if(expected && actual){
    if(expected <= 6 && actual > Math.max(expected + 4, expected * 2)) return false
    if(specialLike && expected <= 12 && actual > expected + 6) return false
    if(seasonLike && expected >= 7 && expected <= 64 && actual > expected + strictEpisodeTolerance(anime)) return false
    if(expected >= 7 && expected <= 64 && actual > expected + strictEpisodeTolerance(anime)) return false
    if(expected <= 3 && isSerialPlayerUrl(row.embed_url) && actual >= 8) return false
  }

  return true
}

function canUsePlayerUrlForAnime(url, anime = {}){
  const cleanUrl = String(url || '').trim()
  if(!cleanUrl) return false
  if(isMovieAnime(anime)) return isMoviePlayerUrl(cleanUrl) && !isSerialPlayerUrl(cleanUrl)
  if(hasStrongPlayerMarker(anime)) return false
  return true
}

async function readEpisodeFromDb(slug, episode, voice = null){
  if(!hasSupabase()) return null
  try{
    const voiceFilter = voice ? `&voice=eq.${encodeURIComponent(String(voice))}` : ''
    const query = `anime_episodes?select=*&anime_slug=eq.${encodeURIComponent(slug)}&episode_number=eq.${encodeURIComponent(String(episode))}${voiceFilter}&order=updated_at.desc&limit=1`
    const res = await supabaseRequest(query, { method: 'GET', timeout: 9000 })
    if(!res.ok) return null
    const rows = await res.json().catch(() => [])
    return Array.isArray(rows) ? rows[0] || null : null
  }catch{
    return null
  }
}

async function readAnimeFromDb(slug){
  if(!hasSupabase()) return null
  try{
    const select = 'slug,title,title_ru,original_title,year,kind,kodik_id,kodik_link,kodik_type,translation_title,translation_type,quality,kodik_raw,episodes,description,description_ru'
    const res = await supabaseRequest(`anime?select=${select}&slug=eq.${encodeURIComponent(slug)}&limit=1`, { method: 'GET', timeout: 9000 })
    if(!res.ok) return null
    const rows = await res.json().catch(() => [])
    return Array.isArray(rows) ? rows[0] || null : null
  }catch{
    return null
  }
}

async function saveResolvedPlayer(slug, episode, player){
  if(!hasSupabase() || !player?.embedUrl) return { ok:false, skipped:true }

  const episodeRow = {
    anime_slug: slug,
    episode_number: Number(episode) || 1,
    title: `Серия ${Number(episode) || 1}`,
    provider: 'kodik',
    voice: player.translationTitle || 'Kodik',
    embed_url: player.embedUrl,
    hls_url: null,
    duration: null,
    status: 'published',
    source: 'kodik-auto',
    raw: player.raw || player,
    updated_at: new Date().toISOString()
  }

  const episodeRes = await supabaseRequest('anime_episodes?on_conflict=anime_slug,episode_number,provider,voice', {
    method: 'POST',
    body: JSON.stringify([episodeRow]),
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    timeout: 10000,
  }).catch(error => ({ ok:false, error }))

  return { ok: Boolean(episodeRes?.ok), episodeSaved: Boolean(episodeRes?.ok) }
}

export async function GET(req){
  const slug = String(req.nextUrl.searchParams.get('slug') || '').trim()
  const episode = Math.max(Number(req.nextUrl.searchParams.get('episode') || 1), 1)
  const voice = String(req.nextUrl.searchParams.get('voice') || '').trim() || null

  if(!slug) return json({ ok:false, error:'slug is required' }, 400)

  const dbAnime = await readAnimeFromDb(slug)
  const dbEpisode = await readEpisodeFromDb(slug, episode, voice)
  const episodeEmbed = normalizeKodikPlayerUrl(dbEpisode?.embed_url)
  if(episodeEmbed && canUsePlayerUrlForAnime(episodeEmbed, dbAnime) && episodeRowMatchesAnime(dbEpisode, dbAnime)){
    return json({
      ok: true,
      provider: dbEpisode.provider || 'kodik',
      source: 'anime_episodes',
      slug,
      episode,
      embedUrl: episodeEmbed,
      voice: dbEpisode.voice || 'Kodik',
      translationType: dbEpisode.raw?.translation_type || null,
      quality: dbEpisode.raw?.quality || (Array.isArray(dbEpisode.quality) ? dbEpisode.quality.join(', ') : dbEpisode.quality || null)
    })
  }

  const animeEmbed = normalizeKodikPlayerUrl(dbAnime?.kodik_link)
  if(animeEmbed && canUsePlayerUrlForAnime(animeEmbed, dbAnime)){
    return json({
      ok: true,
      provider: 'kodik',
      source: 'anime.kodik_link',
      slug,
      episode,
      embedUrl: animeEmbed,
      title: dbAnime.title_ru || dbAnime.title || null,
      voice: dbAnime.translation_title || 'Kodik',
      translationType: dbAnime.translation_type || null,
      quality: dbAnime.quality || null,
      kodikId: dbAnime.kodik_id || null
    })
  }

  if(runtimeResolveEnabled(req)){
    if(!hasKodik()) return json({ ok:false, source:'runtime', error:'KODIK_TOKEN is not configured' }, 200)

    try{
      const item = await getAnimeBySlugFromRepo(slug)
      const player = await resolveKodikPlayerForAnime({
        slug: item.slug,
        title: item.title,
        title_ru: item.titleRu,
        original_title: item.originalTitle,
        kind: item.kind,
        episodes: item.episodes,
        year: item.year
      })

      if(player?.embedUrl){
        const saved = await saveResolvedPlayer(slug, episode, player).catch(error => ({ ok:false, error:error?.message || String(error) }))
        return json({
          ok: true,
          provider: 'kodik',
          source: 'kodik-runtime-resolve',
          slug,
          episode,
          embedUrl: player.embedUrl,
          title: player.title,
          voice: player.translationTitle || 'Kodik',
          translationType: player.translationType || null,
          quality: player.quality || null,
          kodikId: player.kodikId || null,
          saved
        })
      }
    }catch(error){
      return json({ ok:false, source:'kodik-runtime-resolve', error:error?.message || String(error) }, 200)
    }
  }

  return json({
    ok: false,
    source: hasSupabase() ? 'supabase' : 'fallback',
    slug,
    episode,
    error: 'Kodik player link is not available yet',
    hint: 'Запусти /api/cron/sync-kodik?enable=1&mode=auto&limit=30 или включи ENABLE_KODIK_PLAYER_RUNTIME=1 для runtime-поиска.'
  }, 200)
}
