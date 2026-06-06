import { verifyCronAccess, cronAuthError } from '@/lib/cronAuth'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

function json(payload, status = 200){
  return Response.json(payload, {
    status,
    headers:{ 'Cache-Control':'no-store, max-age=0' }
  })
}

async function readText(res){
  return await res.text().catch(() => '')
}

export async function GET(req){
  const auth = verifyCronAccess(req)
  if(!auth.ok) return cronAuthError(auth)

  const url = req.nextUrl || new URL(req.url)
  const enabled = url.searchParams.get('enable') === '1'
  const dryRun = url.searchParams.get('dry') === '1'
  const slug = '527-pokemon'

  if(!enabled){
    return json({ ok:false, error:'disabled', hint:'Добавь ?enable=1&token=CRON_SECRET' }, 400)
  }
  if(!hasSupabase()) return json({ ok:false, error:'supabase is not configured' }, 500)

  const animePatch = {
    title:'Pocket Monsters: Mezase Pokemon Master',
    title_ru:'Покемон: Стремление стать мастером покемонов',
    original_title:'Pocket Monsters: Mezase Pokémon Master',
    year:2023,
    episodes:11,
    kind:'tv',
    status:'completed',
    description_ru:'«Покемон: Стремление стать мастером покемонов» — мини-сериал 2023 года на 11 серий. Это отдельный финальный блок путешествия Эша и Пикачу, поэтому он не должен смешиваться с оригинальным сериалом 1997 года и другими сезонами Pokémon.'
  }

  if(dryRun){
    return json({ ok:true, dryRun:true, slug, animePatch, cleanup:'delete anime_episodes where episode_number > 11' })
  }

  const patchRes = await supabaseRequest(`anime?slug=eq.${encodeURIComponent(slug)}`, {
    method:'PATCH',
    body:JSON.stringify(animePatch),
    headers:{ Prefer:'return=representation' },
    timeout:12000,
  })
  const patchBody = await readText(patchRes)

  const deleteRes = await supabaseRequest(`anime_episodes?anime_slug=eq.${encodeURIComponent(slug)}&episode_number=gt.11`, {
    method:'DELETE',
    headers:{ Prefer:'return=representation' },
    timeout:15000,
  })
  const deleteText = await readText(deleteRes)
  let deletedRows = []
  try{ deletedRows = JSON.parse(deleteText) }catch{}

  return json({
    ok:patchRes.ok && deleteRes.ok,
    auth:auth.mode,
    slug,
    animeUpdate:{ ok:patchRes.ok, status:patchRes.status, body:patchBody ? patchBody.slice(0, 800) : null },
    episodeCleanup:{ ok:deleteRes.ok, status:deleteRes.status, deleted:Array.isArray(deletedRows) ? deletedRows.length : null, body:Array.isArray(deletedRows) ? undefined : deleteText.slice(0, 800) },
    nextCheck:`/api/player/options?slug=${slug}&debug=1`
  }, patchRes.ok && deleteRes.ok ? 200 : 500)
}
