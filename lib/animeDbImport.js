import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { translateGenres, makeRussianDescription, cleanPublicText } from '@/lib/ruContent'

function cleanString(value){
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text || null
}

function normalizeTitleRu(value){
  const text = cleanPublicText(String(value || '').replace(/\s+/g, ' ').trim())
  return /[А-Яа-яЁё]/.test(text) ? text : null
}

function stripUndefined(row){
  const next = { ...row }
  Object.keys(next).forEach(key => {
    const value = next[key]
    if(value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) delete next[key]
  })
  return next
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

export function normalizeExternalAnimeForDb(row, { source = 'jikan', titleRu = '' } = {}){
  const slug = cleanString(row.slug) || `anime-${row.mal_id || row.shikimori_id || Date.now()}`
  const rawGenres = Array.isArray(row.genres) ? row.genres : String(row.genres || '').split(',').map(x => x.trim()).filter(Boolean)
  const genres = translateGenres(rawGenres)
  const normalizedTitleRu = normalizeTitleRu(titleRu || row.title_ru)
  const title = cleanString(row.title || row.original_title || normalizedTitleRu) || 'Без названия'
  const originalTitle = cleanString(row.original_title || row.originalTitle || row.title) || title
  const kind = cleanString(row.kind) || 'tv'
  const status = cleanString(row.status)
  const year = Number(row.year || 0) || null
  const episodes = Number(row.episodes || 0) || 0
  const descriptionRu = cleanString(row.description_ru) || makeRussianDescription({ title: normalizedTitleRu || title, original_title: originalTitle, genres, kind, status, year, episodes })
  const description = cleanString(row.description) || descriptionRu

  return stripUndefined({
    mal_id: row.mal_id ?? row.malId ?? null,
    shikimori_id: row.shikimori_id ?? row.shikimoriId ?? row.mal_id ?? row.malId ?? null,
    slug,
    title,
    title_ru: normalizedTitleRu,
    original_title: originalTitle,
    description,
    description_ru: descriptionRu,
    status,
    kind,
    year,
    episodes,
    rating: Number(row.rating || row.score || 0) || null,
    poster_url: cleanString(row.poster_url || row.poster),
    banner_url: cleanString(row.banner_url || row.banner || row.poster_url || row.poster),
    genres,
    studio: cleanString(row.studio),
    provider: cleanString(row.provider) || source,
    raw: row.raw || row,
    updated_at: new Date().toISOString(),
  })
}

async function upsertAnimeRows(rows, conflictKey){
  if(!rows.length) return { ok:true, saved:0, data:[] }
  const res = await supabaseRequest(`anime?on_conflict=${conflictKey}`, {
    method:'POST',
    body: JSON.stringify(rows),
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    timeout: 18000
  })
  const text = await res.text()
  let parsed = null
  try{ parsed = text ? JSON.parse(text) : null }catch{}
  if(!res.ok){
    return { ok:false, saved:0, error:`Supabase upsert failed (${conflictKey}): ${res.status} ${text}` }
  }
  return { ok:true, saved:Array.isArray(parsed) ? parsed.length : rows.length, data:Array.isArray(parsed) ? parsed : [] }
}

export async function saveAnimeRowsToDb(rows, { source = 'jikan', titleRu = '' } = {}){
  if(!hasSupabase()) return { ok:false, skipped:true, reason:'Supabase env is not configured' }
  const normalized = rows.map(row => normalizeExternalAnimeForDb(row, { source, titleRu }))
  if(!normalized.length) return { ok:true, saved:0, data:[] }

  const withMal = uniqBy(normalized.filter(row => row.mal_id), row => row.mal_id)
  const withoutMal = uniqBy(normalized.filter(row => !row.mal_id), row => row.slug)

  let malResult = await upsertAnimeRows(withMal, 'mal_id')
  if(!malResult.ok && /column|schema cache|PGRST204|does not exist|mal_id/i.test(malResult.error || '')){
    const legacyRows = withMal.map(stripMalId).filter(row => row.shikimori_id)
    malResult = await upsertAnimeRows(legacyRows, 'shikimori_id')
    if(malResult.ok) malResult.legacySchema = true
  }
  if(!malResult.ok) return malResult

  const slugResult = await upsertAnimeRows(withoutMal.map(row => row.mal_id ? row : stripMalId(row)), 'slug')
  if(!slugResult.ok) return slugResult

  return {
    ok:true,
    saved: malResult.saved + slugResult.saved,
    remoteSaved: malResult.saved,
    localSaved: slugResult.saved,
    legacySchema: Boolean(malResult.legacySchema),
    data: [...(malResult.data || []), ...(slugResult.data || [])],
    conflictKeys: malResult.legacySchema ? { remote:'shikimori_id', local:'slug' } : { remote:'mal_id', local:'slug' }
  }
}

export async function findExistingAnimeByMalIds(malIds = []){
  if(!hasSupabase()) return new Map()
  const ids = Array.from(new Set(malIds.map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0))).slice(0, 40)
  if(!ids.length) return new Map()
  const map = new Map()
  for(const column of ['mal_id', 'shikimori_id']){
    try{
      const res = await supabaseRequest(`anime?select=slug,title,title_ru,mal_id,shikimori_id&${column}=in.(${ids.join(',')})`, { method:'GET', timeout:12000 })
      const text = await res.text()
      let rows = []
      try{ rows = text ? JSON.parse(text) : [] }catch{}
      if(res.ok && Array.isArray(rows)){
        for(const row of rows){
          const id = Number(row.mal_id || row.shikimori_id)
          if(id) map.set(id, row)
        }
      }
    }catch{}
  }
  return map
}
