import { getAnimeBySlugFromRepo, getAnimeList, getEpisodesBySlug, normalizeEpisodeForDb } from '@/lib/animeRepository'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'

function json(data, status = 200){
  return Response.json(data, { status })
}

export async function GET(req){
  const slug = req.nextUrl.searchParams.get('slug')

  if(slug){
    const item = await getAnimeBySlugFromRepo(slug)
    const episodes = await getEpisodesBySlug(slug, item?.episodes || item?.episodesList?.length || 12)
    return json({ ok: true, mode: hasSupabase() ? 'supabase' : 'fallback', slug, item, episodes })
  }

  const anime = await getAnimeList({ limit: 720 })
  return json({
    ok: true,
    mode: hasSupabase() ? 'supabase' : 'fallback',
    anime: anime.slice(0, 500).map(item => ({ slug: item.slug, title: item.title, episodes: item.episodes || item.episodesList?.length || 12, poster: item.poster }))
  })
}

export async function POST(req){
  if(!hasSupabase()) return json({ ok: false, error: 'Supabase env is not configured' }, 400)

  let payload
  try{
    payload = await req.json()
  }catch(error){
    return json({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const list = Array.isArray(payload) ? payload : [payload]
  const normalized = list.map(normalizeEpisodeForDb).filter(item => item.anime_slug && item.episode_number)

  if(!normalized.length) return json({ ok: false, error: 'No valid episodes to save' }, 400)

  try{
    const res = await supabaseRequest('anime_episodes?on_conflict=anime_slug,episode_number,provider,voice', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(normalized),
      timeout: 15000,
    })

    if(!res.ok) return json({ ok: false, error: `Supabase upsert failed: ${res.status} ${await res.text()}` }, 500)
    const saved = await res.json().catch(() => [])
    return json({ ok: true, saved: Array.isArray(saved) ? saved.length : normalized.length, items: saved })
  }catch(error){
    return json({ ok: false, error: `Supabase request failed: ${error?.message || error}` }, 500)
  }
}
