import { verifyCronAccess, cronAuthError } from '@/lib/cronAuth'
import { fetchJikanAnimePaged, fetchJikanAnimeDetails, normalizeJikanAnime, searchJikanAnimeVariants, pickBestJikanSearchCandidate, scoreJikanSearchCandidate } from '@/lib/jikan'
import { saveAnimeRowsToDb } from '@/lib/animeDbImport'
import { enrichMissingTitleAfterImport, resolveRussianTitle } from '@/lib/missingTitleEnrichment'

function splitList(value){
  return String(value || '')
    .split(/[\n;,]+/)
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 30)
}

function hasCyrillic(value){
  return /[А-Яа-яЁё]/.test(String(value || ''))
}

function cyrillicTitle(value){
  const text = String(value || '').replace(/([а-яё])([A-Z])/giu, '$1 $2')
  const ru = text.replace(/[^А-Яа-яЁё0-9\s:'’.,!?#&+\-]/g, ' ').replace(/\s+/g, ' ').trim()
  return hasCyrillic(ru) ? ru : ''
}

async function importMalId(malId, { titleRu = '', query = '', enrich = true, kodik = true } = {}){
  const details = await fetchJikanAnimeDetails(malId)
  if(!details) return { ok:false, malId, error:'not_found' }
  const normalized = normalizeJikanAnime(details)
  const resolvedTitleRu = resolveRussianTitle({ explicitTitleRu:titleRu, query, malId, row:normalized })
  if(resolvedTitleRu) normalized.title_ru = resolvedTitleRu
  const database = await saveAnimeRowsToDb([normalized], { source:'jikan-missing-title-mal-id', titleRu:resolvedTitleRu })
  const enrichment = enrich && database?.ok
    ? await enrichMissingTitleAfterImport({ normalized, database, query, titleRu:resolvedTitleRu, enrichKodik:kodik, saveEpisodes:kodik })
    : null
  return {
    ok:Boolean(database.ok),
    malId,
    resolvedBy:'mal_id',
    item:{ slug:normalized.slug, malId:normalized.mal_id, title:normalized.title, titleRu:resolvedTitleRu || normalized.title_ru || '', kind:normalized.kind, year:normalized.year, episodes:normalized.episodes },
    database,
    enrichment
  }
}

async function importQuery(q, type = '', { titleRu = '', enrich = true, kodik = true } = {}){
  const search = await searchJikanAnimeVariants({ q, type, limit:10, order:'title' })
  const picked = pickBestJikanSearchCandidate(search.data, q, { minScore:70 })
  const found = picked.item
  if(!found){
    return {
      ok:false,
      q,
      type:type || null,
      attempts:search.attempts,
      error:'no_strict_match',
      bestScore:picked.best?.relevance?.score || 0,
      candidates:picked.ranked.slice(0, 5).map(row => ({ malId:row.item?.mal_id, title:row.item?.title_english || row.item?.title, type:row.item?.type, score:row.relevance?.score, matchedTitle:row.relevance?.matchedTitle }))
    }
  }
  let details = found
  try{ details = await fetchJikanAnimeDetails(found.mal_id) || found }catch{}
  const normalized = normalizeJikanAnime(details)
  const resolvedTitleRu = resolveRussianTitle({ explicitTitleRu:titleRu, query:q, malId:normalized.mal_id, row:normalized })
  if(resolvedTitleRu) normalized.title_ru = resolvedTitleRu
  const database = await saveAnimeRowsToDb([normalized], { source:'jikan-missing-title', titleRu:resolvedTitleRu })
  const enrichment = enrich && database?.ok
    ? await enrichMissingTitleAfterImport({ normalized, database, query:q, titleRu:resolvedTitleRu, enrichKodik:kodik, saveEpisodes:kodik })
    : null
  return {
    ok:Boolean(database.ok),
    q,
    type:type || null,
    attempts:search.attempts,
    item:{ slug:normalized.slug, malId:normalized.mal_id, title:normalized.title, titleRu:resolvedTitleRu, kind:normalized.kind, year:normalized.year, episodes:normalized.episodes },
    database,
    enrichment
  }
}

async function importTypePages({ types, pages, limit, order, withDetails, delay }){
  const rows = []
  const batches = []
  for(const type of types){
    const remote = await fetchJikanAnimePaged({ type, pages, limit, order, delay })
    batches.push({ type, found:remote.length })
    for(const item of remote){
      let details = item
      if(withDetails){
        try{ details = await fetchJikanAnimeDetails(item.mal_id) || item }catch{}
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      rows.push(normalizeJikanAnime(details))
    }
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  const database = await saveAnimeRowsToDb(rows, { source:'jikan-type-backfill' })
  return { rows, batches, database }
}

export async function GET(request){
  const auth = verifyCronAccess(request)
  if(!auth.ok) return cronAuthError(auth)
  const { searchParams } = new URL(request.url)
  const queries = splitList(searchParams.get('q') || searchParams.get('titles') || process.env.AIANIME_MISSING_TITLES || '')
  const malIds = splitList(searchParams.get('malId') || searchParams.get('mal_id') || searchParams.get('id')).map(Number).filter(x => Number.isFinite(x) && x > 0)
  const explicitTitleRu = String(searchParams.get('titleRu') || searchParams.get('title_ru') || '').trim()
  const type = String(searchParams.get('type') || '').trim().toLowerCase()
  const preset = String(searchParams.get('preset') || '').trim().toLowerCase()
  const types = preset === 'mini'
    ? ['ona', 'special']
    : splitList(searchParams.get('types')).map(x => x.toLowerCase()).filter(Boolean)
  const pages = Math.min(Math.max(Number(searchParams.get('pages') || 1), 1), 8)
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 10), 1), 25)
  const order = searchParams.get('order') || 'popularity'
  const withDetails = searchParams.get('details') === '1'
  const enrich = searchParams.get('enrich') !== '0'
  const kodik = searchParams.get('kodik') !== '0'
  const delay = Math.min(Math.max(Number(searchParams.get('delay') || process.env.JIKAN_SYNC_DELAY_MS || 900), 500), 4000)
  const startedAt = new Date().toISOString()
  const imported = []
  let typeBackfill = null

  try{
    for(const malId of malIds){
      imported.push(await importMalId(malId, { titleRu:explicitTitleRu, query:queries[0] || '', enrich, kodik }))
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    for(const q of queries){
      imported.push(await importQuery(q, type, { titleRu:explicitTitleRu, enrich, kodik }))
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    if(types.length){
      typeBackfill = await importTypePages({ types, pages, limit, order, withDetails, delay })
    }

    const savedFromQueries = imported.reduce((sum, item) => sum + Number(item.database?.saved || 0), 0)
    return Response.json({
      ok:true,
      source:'missing-titles',
      requested:{ queries, malIds, titleRu:explicitTitleRu || null, type:type || null, preset:preset || null, types, pages, limit, order, details:withDetails, enrich, kodik },
      imported,
      typeBackfill: typeBackfill ? { batches:typeBackfill.batches, saved:typeBackfill.database?.saved || 0, database:typeBackfill.database } : null,
      saved: savedFromQueries + Number(typeBackfill?.database?.saved || 0),
      auth:auth.mode,
      startedAt,
      finishedAt:new Date().toISOString(),
      hint:'Для точного импорта используй malId=57782. По умолчанию импорт сразу дополняет title_ru/description и пробует Kodik-плеер. Можно отключить: enrich=0 или kodik=0.'
    })
  }catch(error){
    return Response.json({ ok:false, source:'missing-titles', error:error?.message || String(error), imported, typeBackfill, startedAt, finishedAt:new Date().toISOString() }, { status:200 })
  }
}
