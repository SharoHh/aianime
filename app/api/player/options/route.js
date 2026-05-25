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
  const isSerialAnime = expectedEpisodes > 1 || String(item?.kind || '').toLowerCase() !== 'movie'
  const hasSerialLinks = valid.some(option => /\/serial\//i.test(String(option.embedUrl || '')) || String(option.materialType || '').includes('serial'))

  let rows = valid
  if(isSerialAnime && hasSerialLinks){
    rows = rows.filter(option => {
      const url = String(option.embedUrl || '')
      const type = String(option.materialType || '')
      if(/\/serial\//i.test(url) || type.includes('serial')) return true
      // Если это настоящая episode-ссылка, она тоже годится.
      if(option.source === 'kodik-api-episode' && option.episodeNumber > 1) return true
      return false
    })
  }

  // Старые строки, найденные только по названию с низким score, часто дают мусорные озвучки от похожих тайтлов.
  rows = rows.filter(option => {
    if(option.source === 'anime.kodik_link') return true
    if(option.source === 'kodik-api-episode') return true
    if(option.reliableId) return true
    if(Number(option.matchScore || 0) >= 160) return true
    return false
  })

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

export async function GET(req){
  const url = new URL(req.url)
  const slug = String(url.searchParams.get('slug') || '').trim()
  const refresh = url.searchParams.get('refresh') === '1'
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 40), 5), 80)

  if(!slug) return json({ ok:false, error:'slug is required' }, 400)

  const item = await getAnimeBySlugFromRepo(slug)
  if(!item) return json({ ok:false, error:'anime not found' }, 404)

  const existingEpisodes = await getEpisodesBySlug(slug, item.episodes || item.episodesList?.length || 1)
  const existingOptions = filterOptionsForAnime(existingEpisodes.map(rowToOption), item)

  if(!refresh && hasNativeEpisodeLinks(existingOptions)){
    return json({ ok:true, source:'anime_episodes', slug, options:existingOptions, saved:0, refreshed:false })
  }

  if(!hasKodik()){
    return json({ ok:true, source:'anime_episodes', slug, options:existingOptions, saved:0, refreshed:false, warning:'KODIK_TOKEN is not configured' })
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
      episodes:item.episodes || item.episodesList?.length || 1
    }, { limit, withEpisodes:true, withEpisodesData:false, minScore:22, maxEpisodes:800 })

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
      refreshed:true
    })
  }catch(error){
    return json({
      ok:true,
      source:'anime_episodes',
      slug,
      options:existingOptions,
      saved:0,
      refreshed:false,
      warning:error?.message || String(error)
    })
  }
}
