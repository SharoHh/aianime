import { getAnimeList } from '@/lib/animeRepository'
import { hasKodik, normalizeKodikPlayerUrl } from '@/lib/kodik'
import { resolvePlayers } from '@/lib/playerProviders'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { verifyCronAccess, cronAuthError } from '@/lib/cronAuth'

function playerSyncEnabled(req){
  return req.nextUrl.searchParams.get('enable') === '1' || process.env.ENABLE_KODIK_PLAYER_SYNC === '1'
}

function externalResolveEnabled(req){
  // По умолчанию НЕ ходим в Kodik для каждого тайтла.
  // Правильная цепочка: sync-kodik сохраняет kodik_link -> players sync сохраняет embed в anime_episodes.
  return req.nextUrl.searchParams.get('resolve') === '1' || req.nextUrl.searchParams.get('external') === '1'
}

function getStoredKodikLink(item){
  return normalizeKodikPlayerUrl(item?.kodikLink || item?.kodik_link || item?.embed_url)
}

function rowFromProvider(item, p, episode){
  return {
    anime_slug:item.slug,
    episode_number:episode,
    title:`Серия ${episode}`,
    provider:p.provider || 'kodik',
    voice:p.voices?.[0] || p.voice || 'Kodik',
    embed_url:p.embed_url,
    hls_url:null,
    status:'published',
    source:p.raw?.source || 'kodik-auto',
    raw:p.raw || p,
    updated_at:new Date().toISOString()
  }
}

export async function GET(req){
  const cronAuth = verifyCronAccess(req)
  if(!cronAuth.ok) return cronAuthError(cronAuth)

  const enabled = playerSyncEnabled(req)
  const allowExternal = externalResolveEnabled(req)
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit') || 30), 1), 80)
  const episode = Math.max(Number(req.nextUrl.searchParams.get('episode') || 1), 1)
  const supabaseOk = hasSupabase()
  const kodikOk = hasKodik()

  const result = {
    ok:false,
    runtimeOk:true,
    // externalOk теперь значит: внешний Kodik был нужен и доступен по env.
    // Если allowExternal=false, player sync может работать без внешнего API через сохранённый kodik_link.
    externalOk: allowExternal ? kodikOk : null,
    databaseOk:supabaseOk,
    provider:'kodik-player',
    auth:cronAuth.mode,
    requested:{ enabled, limit, episode, allowExternal },
    env:{ hasKodikToken:kodikOk, hasSupabase:supabaseOk },
    checked:0,
    storedLinks:0,
    resolved:0,
    saved:0,
    mode:supabaseOk?'supabase':'dry-run',
    rows:[],
    errors:[],
    warnings:[]
  }

  if(!enabled){
    return Response.json({ ...result, ok:true, hint:'Player sync disabled. Use ?enable=1 or ENABLE_KODIK_PLAYER_SYNC=1.' })
  }

  if(!supabaseOk){
    result.warnings.push('Supabase env is not configured. Ручка может сделать dry-run, но не сохранит anime_episodes.')
  }

  if(allowExternal && !kodikOk){
    return Response.json({
      ...result,
      ok:false,
      error:'KODIK_TOKEN is not configured',
      hint:'Добавь KODIK_TOKEN. Без него внешний Kodik resolve не сможет получить embed-ссылки.'
    }, { status:200 })
  }

  const selected = (await getAnimeList({ limit })).slice(0, limit)
  result.checked = selected.length
  const rows = []

  for(const item of selected){
    const storedLink = getStoredKodikLink(item)

    if(storedLink){
      result.storedLinks += 1
      rows.push(rowFromProvider(item, {
        provider:'kodik',
        title:item.title,
        embed_url:storedLink,
        quality:item.quality ? [item.quality] : [],
        voices:item.translationTitle ? [item.translationTitle] : ['Kodik'],
        raw:{
          source:'anime.kodik_link',
          kodik_id:item.kodikId || null,
          kodik_link:storedLink,
          translation_title:item.translationTitle || null,
          translation_type:item.translationType || null,
          quality:item.quality || null
        }
      }, episode))
      continue
    }

    if(!allowExternal){
      result.warnings.push({
        slug:item.slug,
        title:item.title,
        reason:'NO_KODIK_METADATA',
        hint:'Сначала запусти /api/cron/sync-kodik?enable=1&limit=20&all=1, чтобы заполнить anime.kodik_link.'
      })
      continue
    }

    const providers = await resolvePlayers(item, { allowExternal:true })
    for(const p of providers){
      if(p.error){
        result.errors.push({ slug:item.slug, title:item.title, error:p.error })
        continue
      }
      if(!p.embed_url) continue
      rows.push(rowFromProvider(item, p, episode))
    }
  }

  result.resolved = rows.length

  if(supabaseOk && rows.length){
    const res = await supabaseRequest('anime_episodes?on_conflict=anime_slug,episode_number,provider,voice', {
      method:'POST',
      body: JSON.stringify(rows),
      headers:{ Prefer:'resolution=merge-duplicates,return=representation' },
      timeout:20000
    })
    if(!res.ok){
      const text = await res.text().catch(() => '')
      return Response.json({ ...result, ok:false, error:text, hint:'Проверь supabase/kodik_player_migration.sql и unique constraint anime_episodes(anime_slug, episode_number, provider, voice).' }, { status:200 })
    }
    const saved = await res.json().catch(() => [])
    result.saved = Array.isArray(saved) ? saved.length : rows.length
  }

  result.ok = Boolean(rows.length && supabaseOk ? result.saved > 0 : rows.length > 0)
  result.rows = rows.slice(0,5)

  if(rows.length){
    result.hint = supabaseOk
      ? 'Kodik player embeds сохранены в anime_episodes. UI читает /api/player и вставляет Kodik iframe автоматически.'
      : 'Dry-run: Kodik embeds найдены, но не сохранены, потому что Supabase env не настроен.'
  }else if(!allowExternal){
    result.hint = 'Плееры не сохранены, потому что у выбранных тайтлов нет anime.kodik_link. Сначала запусти Kodik metadata sync, потом повтори players sync.'
  }else{
    result.hint = 'Плееры не найдены через внешний Kodik resolve. Проверь Kodik API в глубокой диагностике или сначала заполни metadata sync.'
  }

  if(result.warnings.length > 20) result.warnings = result.warnings.slice(0, 20)
  if(result.errors.length > 20) result.errors = result.errors.slice(0, 20)

  return Response.json(result)
}
