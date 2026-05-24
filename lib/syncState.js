import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'

const STATE_ID = 'jikan_catalog'

function defaultState(){
  return {
    id: STATE_ID,
    provider: 'jikan',
    mode: 'catalog',
    next_page: 1,
    total_synced: 0,
    metadata: {}
  }
}

function normalizeState(row){
  if(!row) return defaultState()
  const meta = row.metadata || row.meta || {}
  return {
    ...defaultState(),
    ...row,
    next_page: Number(row.next_page || row.page || meta.next_page || 1),
    total_synced: Number(row.total_synced || meta.total_synced || meta.synced || 0),
    metadata: meta
  }
}

export async function readJikanSyncState(){
  if(!hasSupabase()){
    return { ok:false, skipped:true, reason:'Supabase env is not configured', state: defaultState() }
  }

  try{
    const res = await supabaseRequest(`sync_state?id=eq.${encodeURIComponent(STATE_ID)}&select=*`, {
      method:'GET',
      timeout: 8000
    })

    if(!res.ok){
      const text = await res.text().catch(() => '')
      return { ok:false, reason:`sync_state read failed: ${res.status} ${text}`, state: defaultState() }
    }

    const rows = await res.json().catch(() => [])
    return { ok:true, state: normalizeState(Array.isArray(rows) && rows[0] ? rows[0] : null) }
  }catch(error){
    return { ok:false, reason:error?.message || String(error), state: defaultState() }
  }
}

async function upsertState(payload){
  const res = await supabaseRequest('sync_state?on_conflict=id', {
    method:'POST',
    body: JSON.stringify([payload]),
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    timeout: 10000
  })
  if(!res.ok){
    const text = await res.text().catch(() => '')
    throw new Error(`sync_state write failed: ${res.status} ${text}`)
  }
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) ? rows[0] : payload
}

export async function writeJikanSyncState({ nextPage, synced = 0, status = 'ok', error = null, startedAt = null, finishedAt = null, metadata = {} } = {}){
  if(!hasSupabase()){
    return { ok:false, skipped:true, reason:'Supabase env is not configured' }
  }

  const now = finishedAt || new Date().toISOString()
  const modern = {
    id: STATE_ID,
    provider: 'jikan',
    mode: 'catalog',
    next_page: Math.max(Number(nextPage) || 1, 1),
    last_started_at: startedAt,
    last_finished_at: now,
    last_status: status,
    last_error: error,
    total_synced: Number(synced || 0),
    metadata,
    updated_at: now
  }

  try{
    const state = await upsertState(modern)
    return { ok:true, state }
  }catch(firstError){
    // Совместимость с ранним ручным sync_state, где колонки называются page/max_page/last_run_at/meta.
    try{
      const legacy = {
        id: STATE_ID,
        provider: 'jikan',
        page: Math.max(Number(nextPage) || 1, 1),
        max_page: Number(metadata.maxPage || metadata.max_page || 200),
        last_run_at: startedAt || now,
        last_success_at: status === 'ok' ? now : null,
        last_error: error || null,
        meta: { ...metadata, total_synced:Number(synced || 0), status },
        updated_at: now
      }
      const state = await upsertState(legacy)
      return { ok:true, state, compatibility:'legacy-sync-state' }
    }catch(secondError){
      return { ok:false, error:secondError?.message || firstError?.message || String(secondError) }
    }
  }
}
