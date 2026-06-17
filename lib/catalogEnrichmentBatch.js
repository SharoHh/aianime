import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { fetchJikanAnimeDetails, normalizeJikanAnime } from '@/lib/jikan'
import { saveAnimeRowsToDb } from '@/lib/animeDbImport'
import { enrichExistingAnimeRow } from '@/lib/missingTitleEnrichment'

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms))
}

function clean(value){
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text || ''
}

function hasCyrillic(value){
  return /[А-Яа-яЁё]/.test(String(value || ''))
}

function asList(value, fallback = []){
  const items = String(value || '')
    .split(/[,;\s]+/)
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
  return items.length ? items : fallback
}

function externalId(row = {}){
  const values = [row.mal_id, row.malId, row.shikimori_id, row.shikimoriId]
  const slugMatch = String(row.slug || '').match(/^(\d+)-/)
  if(slugMatch) values.push(slugMatch[1])
  for(const value of values){
    const id = Number(value)
    if(Number.isFinite(id) && id > 0) return Math.floor(id)
  }
  return null
}

function isPlaceholderPoster(value){
  const poster = clean(value).toLowerCase()
  if(!poster) return true
  return /\/posters\/magic|placeholder|no[-_]?poster|default/.test(poster)
}

function isEmptyKodik(row = {}){
  if(clean(row.kodik_id) || clean(row.kodik_link) || clean(row.translation_title) || clean(row.translation_name)) return false
  const raw = row.kodik_raw
  return !raw || (typeof raw === 'object' && !Array.isArray(raw) && !Object.keys(raw).length)
}

export function needsCatalogEnrichment(row = {}, { kodik = true, poster = true, title = true, description = true } = {}){
  if(!row?.slug) return false
  const titleRuMissing = title && !hasCyrillic(row.title_ru || row.titleRu || '')
  const desc = clean(row.description_ru || row.description || '')
  const descriptionMissing = description && desc.length < 90
  const posterMissing = poster && isPlaceholderPoster(row.poster_url || row.poster || row.banner_url)
  const kodikMissing = kodik && isEmptyKodik(row)
  return titleRuMissing || descriptionMissing || posterMissing || kodikMissing
}

const SELECT_COLUMNS = [
  'id','slug','title','title_ru','original_title','description','description_ru','status','kind','year','episodes','rating',
  'poster_url','banner_url','genres','studio','provider','raw','updated_at','shikimori_id','mal_id',
  'kodik_id','kodik_link','title_orig_kodik','title_orig','kodik_raw','kodik_match_score','translation_title','translation_name'
].join(',')

async function fetchRowsForType(type, { scanLimit = 80, order = 'updated_at.desc' } = {}){
  const path = `anime?select=${SELECT_COLUMNS}&kind=eq.${encodeURIComponent(type)}&order=${encodeURIComponent(order)}&limit=${Math.max(1, Math.min(Number(scanLimit) || 80, 250))}`
  const res = await supabaseRequest(path, { method:'GET', timeout:14000 })
  const text = await res.text().catch(() => '')
  let rows = []
  try{ rows = text ? JSON.parse(text) : [] }catch{}
  if(!res.ok) throw new Error(`Supabase select failed: ${res.status} ${text}`)
  return Array.isArray(rows) ? rows : []
}

async function fetchRowsBySlugs(slugs = []){
  const safe = Array.from(new Set(slugs.map(clean).filter(Boolean))).slice(0, 30)
  if(!safe.length) return []
  const quoted = safe.map(slug => `"${slug.replace(/"/g, '')}"`).join(',')
  const path = `anime?select=${SELECT_COLUMNS}&slug=in.(${encodeURIComponent(quoted)})&limit=${safe.length}`
  const res = await supabaseRequest(path, { method:'GET', timeout:14000 })
  const text = await res.text().catch(() => '')
  let rows = []
  try{ rows = text ? JSON.parse(text) : [] }catch{}
  if(!res.ok) throw new Error(`Supabase select by slug failed: ${res.status} ${text}`)
  return Array.isArray(rows) ? rows : []
}

async function enrichWithJikanIfNeeded(row = {}, { enabled = true } = {}){
  if(!enabled) return { row, jikan:null }
  const needsJikan = isPlaceholderPoster(row.poster_url || row.poster || row.banner_url) || clean(row.description || row.description_ru).length < 90
  const id = externalId(row)
  if(!needsJikan || !id) return { row, jikan:null }

  try{
    const details = await fetchJikanAnimeDetails(id)
    if(!details) return { row, jikan:{ ok:false, skipped:true, reason:'not-found', id } }
    const normalized = normalizeJikanAnime(details)
    if(row.title_ru) normalized.title_ru = row.title_ru
    const saved = await saveAnimeRowsToDb([normalized], { source:'jikan-existing-enrichment', titleRu:row.title_ru || '' })
    const savedRow = Array.isArray(saved?.data) && saved.data[0] ? saved.data[0] : null
    return { row:savedRow ? { ...row, ...savedRow } : { ...row, ...normalized }, jikan:{ ok:Boolean(saved?.ok), id, saved:saved?.saved || 0, error:saved?.error || null } }
  }catch(error){
    return { row, jikan:{ ok:false, id, error:error?.message || String(error) } }
  }
}

export async function findCatalogRowsNeedingEnrichment({ types = ['ona','special','ova'], slugs = [], limit = 8, scanLimit = 120, flags = {} } = {}){
  if(!hasSupabase()) return { ok:false, error:'Supabase env is not configured', rows:[] }

  const rows = slugs.length
    ? await fetchRowsBySlugs(slugs)
    : (await Promise.all(types.map(type => fetchRowsForType(type, { scanLimit })))).flat()

  const seen = new Set()
  const filtered = []
  for(const row of rows){
    if(!row?.slug || seen.has(row.slug)) continue
    seen.add(row.slug)
    if(slugs.length || needsCatalogEnrichment(row, flags)) filtered.push(row)
    if(filtered.length >= limit) break
  }
  return { ok:true, scanned:rows.length, rows:filtered }
}

export async function enrichCatalogBatch({ types = ['ona','special','ova'], slugs = [], limit = 6, scanLimit = 120, delay = 1600, jikan = true, kodik = true, saveEpisodes = true } = {}){
  const safeLimit = Math.max(1, Math.min(Number(limit) || 6, 20))
  const safeDelay = Math.max(500, Math.min(Number(delay) || 1600, 6000))
  const selected = await findCatalogRowsNeedingEnrichment({
    types,
    slugs,
    limit:safeLimit,
    scanLimit:Math.max(safeLimit * 8, Number(scanLimit) || 80),
    flags:{ kodik, poster:true, title:true, description:true }
  })
  if(!selected.ok) return selected

  const results = []
  for(const row of selected.rows){
    const startedAt = new Date().toISOString()
    const jikanResult = await enrichWithJikanIfNeeded(row, { enabled:jikan })
    const enriched = await enrichExistingAnimeRow(jikanResult.row, { enrichKodik:kodik, saveEpisodes })
    results.push({
      slug:row.slug,
      title:row.title_ru || row.title || row.original_title || row.slug,
      before:{
        titleRu:Boolean(hasCyrillic(row.title_ru)),
        poster:!isPlaceholderPoster(row.poster_url || row.poster || row.banner_url),
        kodik:!isEmptyKodik(row),
        description:clean(row.description_ru || row.description).length,
      },
      jikan:jikanResult.jikan,
      enrichment:enriched,
      startedAt,
      finishedAt:new Date().toISOString(),
    })
    await sleep(safeDelay)
  }

  return {
    ok:true,
    scanned:selected.scanned,
    selected:selected.rows.length,
    processed:results.length,
    results,
  }
}

export function parseCatalogEnrichmentParams(searchParams){
  const types = asList(searchParams.get('types'), ['ona','special','ova'])
  const slugs = String(searchParams.get('slug') || searchParams.get('slugs') || '')
    .split(/[,;\n]+/)
    .map(clean)
    .filter(Boolean)
    .slice(0, 30)
  return {
    types,
    slugs,
    limit:Math.min(Math.max(Number(searchParams.get('limit') || 6), 1), 20),
    scanLimit:Math.min(Math.max(Number(searchParams.get('scan') || 120), 20), 250),
    delay:Math.min(Math.max(Number(searchParams.get('delay') || 1600), 500), 6000),
    jikan:searchParams.get('jikan') !== '0',
    kodik:searchParams.get('kodik') !== '0',
    saveEpisodes:searchParams.get('episodes') !== '0',
  }
}
