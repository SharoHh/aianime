import { anime as seedAnime } from '@/lib/data'
import { normalizeSeedForDb } from '@/lib/animeRepository'
import { fetchJikanAnimePaged, fetchJikanAnimeDetails, normalizeJikanAnime } from '@/lib/jikan'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { verifyCronAccess, cronAuthError } from '@/lib/cronAuth'
import { readJikanSyncState, writeJikanSyncState } from '@/lib/syncState'
import { translateGenres, makeRussianDescription } from '@/lib/ruContent'

function localPosterBySlug(slug){
  const local = [
    ['/posters/magic2.svg', ['magic', 'jujutsu']],
    ['/posters/onepiece.svg', ['one-piece', 'piece']],
    ['/posters/demons.svg', ['demon', 'kimetsu']],
    ['/posters/solo.svg', ['solo']],
    ['/posters/name.svg', ['name', 'kimi']],
    ['/posters/stone.svg', ['stone']],
    ['/posters/oshi.svg', ['oshi']],
    ['/posters/marriage.svg', ['marriage']]
  ]
  const text = String(slug || '').toLowerCase()
  return local.find(([_, keys]) => keys.some(key => text.includes(key)))?.[0] || '/posters/magic2.svg'
}

function isMissingPoster(url){
  return !url || /missing_(original|preview|x160|x96)\.jpg/i.test(url)
}

function normalizePosterUrl(url, slug){
  if(isMissingPoster(url)) return localPosterBySlug(slug)
  return url
}

function pickId(row, index){
  const malId = row.mal_id ?? row.malId ?? null
  const legacyId = row.shikimori_id ?? row.shikimoriId ?? null
  return malId ?? legacyId ?? null
}

function normalizeRows(rows, source){
  return rows.map((row, index) => {
    const externalId = pickId(row, index)
    const slug = row.slug || `anime-${externalId || index}`

    return {
      mal_id: row.mal_id ?? row.malId ?? (source === 'jikan' ? externalId : null),
      // Legacy column kept so old Supabase schemas work without immediate migration.
      // In Jikan mode this legacy value is the MAL id.
      shikimori_id: row.shikimori_id ?? row.shikimoriId ?? (source === 'jikan' ? externalId : null),
      slug,
      title: row.title || row.original_title || 'Без названия',
      original_title: row.original_title || row.originalTitle || row.title || null,
      description: row.description || null,
      description_ru: row.description_ru || makeRussianDescription({ ...row, slug }),
      status: row.status || null,
      kind: row.kind || null,
      year: row.year ?? null,
      episodes: row.episodes ?? 0,
      rating: row.rating ?? row.score ?? null,
      poster_url: normalizePosterUrl(row.poster_url || row.poster || null, slug),
      banner_url: normalizePosterUrl(row.banner_url || row.banner || row.poster_url || row.poster || null, slug),
      genres: translateGenres(row.genres),
      studio: row.studio || null,
      provider: row.provider || source,
      raw: row.raw || row,
      updated_at: new Date().toISOString(),
    }
  })
}

function stripMalId(row){
  const { mal_id, ...rest } = row
  return rest
}

function uniqBy(rows, keyFn){
  const map = new Map()
  for(const row of rows){
    const key = keyFn(row)
    if(key !== null && key !== undefined && key !== '') map.set(String(key), row)
  }
  return Array.from(map.values())
}

async function upsertAnimeRows(rows, conflictKey){
  if(!rows.length) return { ok:true, saved:0 }

  const res = await supabaseRequest(`anime?on_conflict=${conflictKey}`, {
    method:'POST',
    body: JSON.stringify(rows),
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' }
  })

  if(!res.ok){
    const text = await res.text().catch(() => '')
    return { ok:false, saved:0, error:`Supabase upsert failed (${conflictKey}): ${res.status} ${text}` }
  }

  const saved = await res.json().catch(() => [])
  return { ok:true, saved:Array.isArray(saved) ? saved.length : rows.length }
}

async function saveRows(rows, source){
  if(!hasSupabase()) {
    return { ok:false, skipped:true, reason:'Supabase env is not configured' }
  }

  if(!rows.length) return { ok:true, saved:0 }

  try{
    const normalized = normalizeRows(rows, source)

    if(source === 'jikan'){
      const jikanRows = uniqBy(normalized.filter(row => row.mal_id), row => row.mal_id)
      const localRows = uniqBy(normalized.filter(row => !row.mal_id), row => row.slug)

      let remoteResult = await upsertAnimeRows(jikanRows, 'mal_id')

      // Если пользователь ещё не применил новую SQL-схему, сохраняем Jikan через старую колонку
      // shikimori_id. Это только сохраняет совместимость БД.
      if(!remoteResult.ok){
        const legacyRows = jikanRows.map(stripMalId).filter(row => row.shikimori_id)
        remoteResult = await upsertAnimeRows(legacyRows, 'shikimori_id')
        if(!remoteResult.ok) return remoteResult
        remoteResult.legacySchema = true
        remoteResult.note = 'Supabase schema without mal_id detected. Jikan MAL ids were stored in legacy external id column.'
      }

      const localResult = await upsertAnimeRows(localRows.map(stripMalId), 'slug')
      if(!localResult.ok) return localResult

      return {
        ok:true,
        saved: remoteResult.saved + localResult.saved,
        remoteSaved: remoteResult.saved,
        localSaved: localResult.saved,
        legacySchema: Boolean(remoteResult.legacySchema),
        note: remoteResult.note,
        conflictKeys: remoteResult.legacySchema ? { remote:'shikimori_id', local:'slug' } : { remote:'mal_id', local:'slug' }
      }
    }

    const remoteRows = uniqBy(
      normalized.filter(row => row.shikimori_id !== null && row.shikimori_id !== undefined),
      row => row.shikimori_id
    ).map(stripMalId)

    const localRows = uniqBy(
      normalized.filter(row => row.shikimori_id === null || row.shikimori_id === undefined),
      row => row.slug
    ).map(stripMalId)

    const remoteResult = await upsertAnimeRows(remoteRows, 'shikimori_id')
    if(!remoteResult.ok) return remoteResult

    const localResult = await upsertAnimeRows(localRows, 'slug')
    if(!localResult.ok) return localResult

    return {
      ok:true,
      saved: remoteResult.saved + localResult.saved,
      remoteSaved: remoteResult.saved,
      localSaved: localResult.saved,
      conflictKeys: { remote:'shikimori_id', local:'slug' }
    }
  }catch(error){
    return {
      ok:false,
      error:`Supabase request failed: ${error?.message || String(error)}`,
      note:'Сайт не упал: данные останутся в seed/cache, но в БД не сохранились.'
    }
  }
}

async function syncFromJikan({ limit, pages, startPage, order, withDetails, status, type, delay }){
  const remote = await fetchJikanAnimePaged({ pages, startPage, limit, order, status, type, delay })
  const rows = []

  for(const item of remote){
    let details = null
    if(withDetails){
      try{
        details = await fetchJikanAnimeDetails(item.mal_id)
        await new Promise(resolve => setTimeout(resolve, Number(process.env.JIKAN_SYNC_DELAY_MS || 900)))
      }catch(error){
        console.warn(`Jikan details failed for ${item.mal_id}:`, error?.message || error)
      }
    }
    rows.push(normalizeJikanAnime(item, details))
  }

  return rows
}

function jikanSyncEnabled(req){
  // ВАЖНО: локальный сайт не должен сам лезть во внешние API.
  // Jikan/MAL запускаем только явно: ?enable=1 или ENABLE_JIKAN_SYNC=1.
  return req.nextUrl.searchParams.get('enable') === '1' || process.env.ENABLE_JIKAN_SYNC === '1'
}

function isAutoMode(req){
  return req.nextUrl.searchParams.get('mode') === 'auto' || req.nextUrl.searchParams.get('auto') === '1'
}

function getNextPage(startPage, pages, maxPage){
  const next = Number(startPage) + Number(pages)
  return next > maxPage ? 1 : next
}


export async function GET(req){
  const startedAt = new Date().toISOString()
  const cronAuth = verifyCronAccess(req)
  if(!cronAuth.ok) return cronAuthError(cronAuth)
  const withDetails = req.nextUrl.searchParams.get('details') === '1'
  const forceSeed = req.nextUrl.searchParams.get('seed') === '1'
  const autoMode = isAutoMode(req)
  const enableJikan = jikanSyncEnabled(req)
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit') || process.env.JIKAN_SYNC_LIMIT || 25), 1), 25)
  const requestedPages = autoMode
    ? Number(req.nextUrl.searchParams.get('pages') || process.env.AUTO_JIKAN_PAGES_PER_RUN || 3)
    : Number(req.nextUrl.searchParams.get('pages') || 4)
  const pages = Math.min(Math.max(requestedPages || 1, 1), 40)
  const order = req.nextUrl.searchParams.get('order') || 'popularity'
  const status = req.nextUrl.searchParams.get('status') || ''
  const type = req.nextUrl.searchParams.get('type') || ''
  const delay = Number(req.nextUrl.searchParams.get('delay') || process.env.JIKAN_SYNC_DELAY_MS || 900)
  const maxPage = Math.min(Math.max(Number(req.nextUrl.searchParams.get('maxPage') || process.env.AUTO_JIKAN_MAX_PAGE || 40), 1), 1000)

  let syncState = null
  let startPage = Math.max(Number(req.nextUrl.searchParams.get('startPage') || req.nextUrl.searchParams.get('page') || 1), 1)

  if(autoMode){
    syncState = await readJikanSyncState()
    startPage = Math.min(Math.max(Number(syncState?.state?.next_page || 1), 1), maxPage)
  }

  let source = 'jikan'
  let rows = []
  let syncError = null

  try{
    if(forceSeed) throw new Error('Seed sync forced by query parameter')
    if(!enableJikan) throw new Error('Jikan sync is disabled for local runtime. Add ?enable=1 or ENABLE_JIKAN_SYNC=1 to run external sync.')
    rows = await syncFromJikan({ limit, pages, startPage, order, withDetails, status, type, delay })
  }catch(error){
    source = 'seed'
    syncError = error?.message || String(error)
    rows = seedAnime.map(normalizeSeedForDb)
  }

  const database = await saveRows(rows, source)
  const fallback = source === 'seed'
  const externalOk = source === 'jikan'
  const databaseOk = Boolean(database?.ok)
  const finishedAt = new Date().toISOString()
  const nextPage = getNextPage(startPage, pages, maxPage)
  let autoStateUpdate = null

  if(autoMode){
    autoStateUpdate = await writeJikanSyncState({
      nextPage: externalOk && databaseOk ? nextPage : startPage,
      synced: Number(syncState?.state?.total_synced || 0) + rows.length,
      status: externalOk && databaseOk ? 'ok' : 'fallback',
      error: syncError,
      startedAt,
      finishedAt,
      metadata: { pages, limit, order, status, type, startPage, nextPage, maxPage, databaseOk, externalOk }
    })
  }

  return Response.json({
    ok:true,
    runtimeOk:true,
    externalOk,
    databaseOk,
    source,
    fallback,
    synced: rows.length,
    requested: { mode: autoMode ? 'auto' : 'manual', pages, startPage, nextPage: autoMode ? nextPage : null, maxPage, limit, order, status, type, details: withDetails, delay, enableJikan },
    auth: cronAuth.mode,
    seedCount: fallback ? rows.length : 0,
    database,
    autoSync: autoMode ? { state: syncState, update: autoStateUpdate } : null,
    error: syncError,
    hint: fallback
      ? 'Это не падение сайта. Runtime отдал seed-каталог. Автопарсинг Jikan требует доступ к api.jikan.moe и настроенный Supabase.'
      : autoMode
        ? 'Автопарсинг Jikan/MAL прошёл. Cursor страницы сохранён, следующий cron продолжит с nextPage.'
        : 'Jikan/MAL успешно отдал данные. Дальше каталог сохраняется в Supabase, если переменные окружения настроены.',
    sample: rows.slice(0,3).map(r => ({ title:r.title, mal_id:r.mal_id, poster_url:r.poster_url, slug:r.slug })),
    startedAt,
    finishedAt
  }, { status:200 })
}
