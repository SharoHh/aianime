import { getAnimeList, normalizeEpisodeForDb } from '@/lib/animeRepository'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { verifyCronAccess, cronAuthError } from '@/lib/cronAuth'

export async function GET(req){
  const cronAuth = verifyCronAccess(req)
  if(!cronAuth.ok) return cronAuthError(cronAuth)

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 80), 300)
  const anime = await getAnimeList({ limit })
  const rows = []

  for(const item of anime){
    const count = Math.max(1, Math.min(Number(item.episodes || item.episodesList?.length || 12), 64))
    for(let i = 1; i <= count; i++){
      rows.push(normalizeEpisodeForDb({
        anime_slug: item.slug,
        episode_number: i,
        title: `Серия ${i}`,
        provider: 'future-auto',
        voice: 'default',
        status: 'placeholder',
        source: 'cron-placeholder',
      }))
    }
  }

  if(!hasSupabase()){
    return Response.json({ ok:true, mode:'dry-run', generated: rows.length, note:'Supabase env is not configured, episodes were not saved.' })
  }

  try{
    const chunkSize = 500
    let saved = 0
    for(let i = 0; i < rows.length; i += chunkSize){
      const chunk = rows.slice(i, i + chunkSize)
      const res = await supabaseRequest('anime_episodes?on_conflict=anime_slug,episode_number,provider,voice', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(chunk),
        timeout: 20000,
      })
      if(!res.ok){
        return Response.json({ ok:false, generated: rows.length, saved, error: `Supabase upsert failed: ${res.status} ${await res.text()}` })
      }
      saved += chunk.length
    }
    return Response.json({ ok:true, mode:'supabase', generated: rows.length, saved, note:'Созданы placeholder-серии. Позже автопарсер сможет обновлять embed_url/hls_url.' })
  }catch(error){
    return Response.json({ ok:false, generated: rows.length, error: error?.message || String(error) })
  }
}
