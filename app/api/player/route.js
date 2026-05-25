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
    const select = 'slug,title,title_ru,original_title,year,kodik_id,kodik_link,kodik_type,translation_title,translation_type,quality,kodik_raw,episodes'
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

  const dbEpisode = await readEpisodeFromDb(slug, episode, voice)
  const episodeEmbed = normalizeKodikPlayerUrl(dbEpisode?.embed_url)
  if(episodeEmbed){
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

  const dbAnime = await readAnimeFromDb(slug)
  const animeEmbed = normalizeKodikPlayerUrl(dbAnime?.kodik_link)
  if(animeEmbed){
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
