import { verifyCronAccess, cronAuthError } from '@/lib/cronAuth'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { enrichAnimeWithKodik, hasKodik } from '@/lib/kodik'

const STATE_ID = 'kodik_metadata'

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms))
}

function kodikSyncEnabled(req){
  // Как и Jikan: внешний Kodik не трогаем сам при открытии сайта.
  // Вручную: ?enable=1. На сервере: ENABLE_KODIK_SYNC=1.
  return req.nextUrl.searchParams.get('enable') === '1' || process.env.ENABLE_KODIK_SYNC === '1'
}

function isAutoMode(req){
  return req.nextUrl.searchParams.get('mode') === 'auto' || req.nextUrl.searchParams.get('auto') === '1'
}

function defaultKodikState(){
  return { id:STATE_ID, next_page:1, total_synced:0, metadata:{} }
}

function normalizeKodikState(row){
  if(!row) return defaultKodikState()
  const meta = row.metadata || row.meta || {}
  return {
    ...defaultKodikState(),
    ...row,
    next_page: Number(row.next_page || row.page || meta.next_page || 1),
    total_synced: Number(row.total_synced || meta.total_synced || meta.synced || 0),
    metadata: meta
  }
}

async function readState(){
  if(!hasSupabase()) return { ok:false, state:defaultKodikState(), reason:'Supabase env is not configured' }

  const res = await supabaseRequest(`sync_state?id=eq.${encodeURIComponent(STATE_ID)}&select=*`, { method:'GET', timeout: 9000 })
  if(!res.ok){
    const text = await res.text().catch(() => '')
    return { ok:false, state:defaultKodikState(), reason:`sync_state read failed: ${res.status} ${text}` }
  }

  const rows = await res.json().catch(() => [])
  return { ok:true, state: normalizeKodikState(Array.isArray(rows) && rows[0] ? rows[0] : null) }
}

async function upsertState(payload){
  const res = await supabaseRequest('sync_state?on_conflict=id', {
    method:'POST',
    body: JSON.stringify([payload]),
    headers: { Prefer:'resolution=merge-duplicates,return=representation' },
    timeout: 10000
  })

  if(!res.ok){
    const text = await res.text().catch(() => '')
    throw new Error(`sync_state write failed: ${res.status} ${text}`)
  }

  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) ? rows[0] : payload
}

async function writeState({ nextPage, totalSynced, status, error, startedAt, finishedAt, metadata } = {}){
  if(!hasSupabase()) return { ok:false, skipped:true, reason:'Supabase env is not configured' }

  const now = finishedAt || new Date().toISOString()
  const modern = {
    id: STATE_ID,
    provider: 'kodik',
    mode: 'metadata',
    next_page: Math.max(Number(nextPage) || 1, 1),
    last_started_at: startedAt,
    last_finished_at: now,
    last_status: status || 'ok',
    last_error: error || null,
    total_synced: Number(totalSynced || 0),
    metadata: metadata || {},
    updated_at: now
  }

  try{
    const state = await upsertState(modern)
    return { ok:true, state }
  }catch(firstError){
    // Совместимость с ручной таблицей sync_state из прошлых правок.
    try{
      const legacy = {
        id: STATE_ID,
        provider: 'kodik',
        page: Math.max(Number(nextPage) || 1, 1),
        max_page: Number(metadata?.maxPage || metadata?.max_page || 200),
        last_run_at: startedAt || now,
        last_success_at: status === 'ok' ? now : null,
        last_error: error || null,
        meta: { ...(metadata || {}), total_synced:Number(totalSynced || 0), status:status || 'ok' },
        updated_at: now
      }
      const state = await upsertState(legacy)
      return { ok:true, state, compatibility:'legacy-sync-state' }
    }catch(secondError){
      return { ok:false, error:secondError?.message || firstError?.message || String(secondError) }
    }
  }
}

async function readAnimeBatch({ page = 1, limit = 30, onlyMissing = true } = {}){
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 80)
  const safePage = Math.max(Number(page) || 1, 1)
  const offset = (safePage - 1) * safeLimit
  const select = 'id,slug,title,original_title,title_ru,year,mal_id,shikimori_id,kodik_id,provider'
  const missingFilter = onlyMissing ? '&kodik_id=is.null' : ''
  const query = `anime?select=${select}${missingFilter}&order=rating.desc.nullslast&limit=${safeLimit}&offset=${offset}`
  const res = await supabaseRequest(query, { method:'GET', timeout: 12000 })

  if(!res.ok){
    const text = await res.text().catch(() => '')
    throw new Error(`anime read failed: ${res.status} ${text}`)
  }

  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) ? rows : []
}

async function updateAnimeWithKodik(slug, patch){
  const payload = { ...patch }
  Object.keys(payload).forEach(key => {
    if(payload[key] === undefined) delete payload[key]
  })

  const res = await supabaseRequest(`anime?slug=eq.${encodeURIComponent(slug)}`, {
    method:'PATCH',
    body: JSON.stringify(payload),
    headers: { Prefer:'return=representation' },
    timeout: 12000
  })

  if(!res.ok){
    const text = await res.text().catch(() => '')
    throw new Error(`anime update failed for ${slug}: ${res.status} ${text}`)
  }

  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) ? rows[0] : null
}

export async function GET(req){
  const startedAt = new Date().toISOString()
  const cronAuth = verifyCronAccess(req)
  if(!cronAuth.ok) return cronAuthError(cronAuth)

  const enableKodik = kodikSyncEnabled(req)
  const autoMode = isAutoMode(req)
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit') || process.env.KODIK_SYNC_LIMIT || 30), 1), 80)
  const delay = Math.min(Math.max(Number(req.nextUrl.searchParams.get('delay') || process.env.KODIK_SYNC_DELAY_MS || 700), 250), 4000)
  const onlyMissing = req.nextUrl.searchParams.get('all') !== '1'
  const maxPage = Math.min(Math.max(Number(req.nextUrl.searchParams.get('maxPage') || process.env.KODIK_SYNC_MAX_PAGE || 200), 1), 5000)

  let state = null
  let page = Math.max(Number(req.nextUrl.searchParams.get('page') || 1), 1)
  if(autoMode){
    state = await readState()
    page = Math.min(Math.max(Number(state?.state?.next_page || 1), 1), maxPage)
  }

  const result = {
    ok: false,
    runtimeOk: true,
    externalOk: false,
    databaseOk: false,
    provider: 'kodik',
    auth: cronAuth.mode,
    requested: { mode:autoMode ? 'auto' : 'manual', enableKodik, page, limit, delay, onlyMissing, maxPage },
    checked: 0,
    matched: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    sample: [],
    startedAt,
    finishedAt: null,
    state: autoMode ? state : null
  }

  try{
    if(!enableKodik) throw new Error('Kodik sync is disabled. Add ?enable=1 or ENABLE_KODIK_SYNC=1 to run external sync.')
    if(!hasKodik()) throw new Error('KODIK_TOKEN is not configured')
    if(!hasSupabase()) throw new Error('Supabase env is not configured')

    result.databaseOk = true
    const rows = await readAnimeBatch({ page, limit, onlyMissing })
    result.checked = rows.length

    for(const row of rows){
      try{
        const patch = await enrichAnimeWithKodik(row, { limit: 5 })
        if(!patch){
          result.skipped += 1
          continue
        }

        await updateAnimeWithKodik(row.slug, patch)
        result.matched += 1
        result.updated += 1
        if(result.sample.length < 5){
          result.sample.push({ slug:row.slug, title:row.title, title_ru:patch.title_ru, translation:patch.translation_title, quality:patch.quality })
        }
      }catch(error){
        result.errors.push({ slug:row.slug, title:row.title, error:error?.message || String(error) })
      }

      await sleep(delay)
    }

    result.externalOk = true
    result.ok = true

    const nextPage = rows.length < limit || page >= maxPage ? 1 : page + 1
    if(autoMode){
      result.stateUpdate = await writeState({
        nextPage,
        totalSynced: Number(state?.state?.total_synced || 0) + result.updated,
        status: result.errors.length ? 'partial' : 'ok',
        error: result.errors[0]?.error || null,
        startedAt,
        finishedAt: new Date().toISOString(),
        metadata: { page, nextPage, limit, delay, checked:result.checked, matched:result.matched, updated:result.updated, onlyMissing }
      })
    }

    result.requested.nextPage = nextPage
    result.hint = 'Kodik metadata sync прошёл. Русские названия, озвучка, качество и screenshots сохранены в Supabase.'
  }catch(error){
    result.error = error?.message || String(error)
    result.hint = 'Это не падение сайта. Kodik sync — отдельный cron для обогащения каталога. Главная страница не должна обращаться к Kodik напрямую.'

    if(autoMode){
      result.stateUpdate = await writeState({
        nextPage: page,
        totalSynced: Number(state?.state?.total_synced || 0),
        status: 'error',
        error: result.error,
        startedAt,
        finishedAt: new Date().toISOString(),
        metadata: { page, limit, delay, onlyMissing }
      }).catch(writeError => ({ ok:false, error:writeError?.message || String(writeError) }))
    }
  }

  result.finishedAt = new Date().toISOString()
  return Response.json(result, { status: 200 })
}
