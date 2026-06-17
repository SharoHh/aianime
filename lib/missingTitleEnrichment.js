import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { hasKodik, enrichAnimeWithKodik, resolveKodikEpisodeRowsForAnime } from '@/lib/kodik'
import { makeRussianDescription, cleanPublicText } from '@/lib/ruContent'

function clean(value){
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text || ''
}

function hasCyrillic(value){
  return /[А-Яа-яЁё]/.test(String(value || ''))
}

export function cyrillicTitleFromQuery(value){
  const text = String(value || '').replace(/([а-яё])([A-Z])/giu, '$1 $2')
  const ru = text
    .replace(/[^А-Яа-яЁё0-9\s:'’.,!?#&+\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return hasCyrillic(ru) ? ru : ''
}

function knownRussianTitle(malId){
  const id = Number(malId)
  const map = new Map([
    [57782, 'Любовь с кончиков пальцев: Мини-аниме'],
  ])
  return map.get(id) || ''
}

export function resolveRussianTitle({ explicitTitleRu = '', query = '', malId = null, row = {}, kodikPatch = null } = {}){
  const values = [
    explicitTitleRu,
    cyrillicTitleFromQuery(query),
    row?.title_ru,
    row?.titleRu,
    kodikPatch?.title_ru,
    knownRussianTitle(malId || row?.mal_id || row?.malId || row?.shikimori_id),
  ]
  for(const value of values){
    const text = cleanPublicText(clean(value))
    if(hasCyrillic(text)) return text
  }
  return ''
}

export function buildCompleteDescription(row = {}, titleRu = ''){
  const generated = makeRussianDescription({
    ...row,
    title_ru: titleRu || row.title_ru || row.titleRu || '',
    title: titleRu || row.title_ru || row.titleRu || row.title,
    original_title: row.original_title || row.originalTitle || row.title_orig_kodik || row.title,
  })
  const descriptionRu = clean(row.description_ru || row.descriptionRu) || generated
  const description = clean(row.description) || descriptionRu || generated
  return { description, description_ru: descriptionRu }
}

function missingColumnFromSupabase(text){
  const raw = String(text || '')
  const quoted = raw.match(/Could not find the '([^']+)' column/i)
  if(quoted?.[1]) return quoted[1]
  const jsonMatch = raw.match(/\"message\":\"Could not find the '([^']+)' column/i)
  if(jsonMatch?.[1]) return jsonMatch[1]
  return null
}

function stripEmptyPatch(payload = {}){
  const next = { ...payload }
  Object.keys(next).forEach(key => {
    const value = next[key]
    if(value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) delete next[key]
  })
  return next
}

async function patchAnime(slug, payload){
  const cleanPayload = stripEmptyPatch(payload)
  if(!slug || !Object.keys(cleanPayload).length) return { ok:false, skipped:true, reason:'empty-patch' }

  const removed = []
  for(let attempt = 0; attempt < 16; attempt++){
    const res = await supabaseRequest(`anime?slug=eq.${encodeURIComponent(slug)}`, {
      method:'PATCH',
      body: JSON.stringify(cleanPayload),
      headers:{ Prefer:'return=representation' },
      timeout:16000
    })
    const text = await res.text().catch(() => '')
    let parsed = null
    try{ parsed = text ? JSON.parse(text) : null }catch{}

    if(res.ok){
      const rows = Array.isArray(parsed) ? parsed : []
      return { ok:true, saved:rows.length, data:rows, removedMissingColumns:removed }
    }

    const missing = missingColumnFromSupabase(text)
    if(missing && Object.prototype.hasOwnProperty.call(cleanPayload, missing)){
      delete cleanPayload[missing]
      removed.push(missing)
      continue
    }

    return { ok:false, error:`anime patch failed: ${res.status} ${text}`, removedMissingColumns:removed }
  }

  return { ok:false, error:`anime patch failed: too many missing columns: ${removed.join(', ')}` }
}

function dedupeEpisodeRows(rows = []){
  const map = new Map()
  for(const row of Array.isArray(rows) ? rows : []){
    if(!row?.anime_slug || !row?.episode_number || !row?.provider || !row?.voice || !row?.embed_url) continue
    const key = `${row.anime_slug}::${Number(row.episode_number) || 1}::${String(row.provider).toLowerCase()}::${String(row.voice).toLowerCase()}`
    const current = map.get(key)
    if(!current){
      map.set(key, row)
      continue
    }
    const score = Number(row?.raw?.match_score || 0)
    const currentScore = Number(current?.raw?.match_score || 0)
    if(score > currentScore) map.set(key, row)
  }
  return Array.from(map.values())
}

async function saveEpisodeRows(rows = []){
  const uniqueRows = dedupeEpisodeRows(rows)
  if(!uniqueRows.length) return { ok:true, saved:0, data:[] }

  const res = await supabaseRequest('anime_episodes?on_conflict=anime_slug,episode_number,provider,voice', {
    method:'POST',
    body: JSON.stringify(uniqueRows),
    headers:{ Prefer:'resolution=merge-duplicates,return=representation' },
    timeout:22000
  })
  const text = await res.text().catch(() => '')
  let parsed = null
  try{ parsed = text ? JSON.parse(text) : null }catch{}
  if(!res.ok) return { ok:false, saved:0, error:`anime_episodes upsert failed: ${res.status} ${text}` }
  return { ok:true, saved:Array.isArray(parsed) ? parsed.length : uniqueRows.length, data:Array.isArray(parsed) ? parsed : [] }
}

function mergeAnimeForRuntime(row = {}, normalized = {}, titleRu = ''){
  const malId = Number(row.mal_id || row.malId || row.shikimori_id || normalized.mal_id || normalized.malId || normalized.shikimori_id || 0) || null
  return {
    ...normalized,
    ...row,
    slug: row.slug || normalized.slug,
    title: row.title || normalized.title,
    title_ru: titleRu || row.title_ru || normalized.title_ru || '',
    titleRu: titleRu || row.title_ru || normalized.title_ru || '',
    original_title: row.original_title || normalized.original_title || row.title_orig || row.title,
    originalTitle: row.original_title || normalized.original_title || row.title_orig || row.title,
    shikimoriId: malId,
    malId,
    year: row.year || normalized.year,
    episodes: row.episodes || normalized.episodes,
    kind: row.kind || normalized.kind,
    description: row.description || normalized.description,
    descriptionRu: row.description_ru || normalized.description_ru,
  }
}

export async function enrichMissingTitleAfterImport({ normalized = {}, database = null, query = '', titleRu = '', enrichKodik = true, saveEpisodes = true } = {}){
  if(!hasSupabase()) return { ok:false, skipped:true, reason:'Supabase env is not configured' }

  const savedRow = Array.isArray(database?.data) && database.data[0] ? database.data[0] : {}
  const slug = savedRow.slug || normalized.slug
  if(!slug) return { ok:false, error:'Missing slug after import' }

  let resolvedTitleRu = resolveRussianTitle({ explicitTitleRu:titleRu, query, malId:normalized.mal_id || savedRow.mal_id || savedRow.shikimori_id, row:{ ...normalized, ...savedRow } })
  let runtimeAnime = mergeAnimeForRuntime(savedRow, normalized, resolvedTitleRu)
  const baseDescriptions = buildCompleteDescription(runtimeAnime, resolvedTitleRu)
  const publicPatch = {
    title_ru: resolvedTitleRu || undefined,
    description: baseDescriptions.description,
    description_ru: baseDescriptions.description_ru,
    updated_at: new Date().toISOString(),
  }
  const publicSave = await patchAnime(slug, publicPatch)

  let kodikPatch = null
  let kodikSave = null
  let episodeRows = []
  let episodeSave = null
  let kodikError = null

  if(enrichKodik){
    if(!hasKodik()){
      kodikError = 'KODIK_TOKEN is not configured'
    }else{
      try{
        runtimeAnime = mergeAnimeForRuntime(publicSave?.data?.[0] || savedRow, normalized, resolvedTitleRu)
        kodikPatch = await enrichAnimeWithKodik(runtimeAnime, { limit: 8 })
        if(kodikPatch){
          resolvedTitleRu = resolveRussianTitle({ explicitTitleRu:resolvedTitleRu, query, malId:runtimeAnime.malId, row:runtimeAnime, kodikPatch })
          const patchedDescriptions = buildCompleteDescription({ ...runtimeAnime, ...kodikPatch }, resolvedTitleRu)
          kodikSave = await patchAnime(slug, {
            ...kodikPatch,
            title_ru: resolvedTitleRu || kodikPatch.title_ru || undefined,
            description: clean(kodikPatch.description) || patchedDescriptions.description,
            description_ru: patchedDescriptions.description_ru,
            updated_at:new Date().toISOString(),
          })
        }
      }catch(error){
        kodikError = error?.message || String(error)
      }

      if(saveEpisodes){
        try{
          const episodeAnime = mergeAnimeForRuntime(kodikSave?.data?.[0] || publicSave?.data?.[0] || savedRow, normalized, resolvedTitleRu)
          episodeRows = await resolveKodikEpisodeRowsForAnime(episodeAnime, {
            limit: 40,
            withEpisodes: true,
            withEpisodesData: true,
            minScore: 22,
            maxEpisodes: 800,
          })
          episodeSave = await saveEpisodeRows(episodeRows)
        }catch(error){
          episodeSave = { ok:false, saved:0, error:error?.message || String(error) }
        }
      }
    }
  }

  return {
    ok:Boolean(publicSave?.ok),
    slug,
    titleRu:resolvedTitleRu || '',
    publicSave,
    kodik:{ ok:Boolean(kodikPatch), patch:kodikPatch, save:kodikSave, error:kodikError },
    episodes:{ found:episodeRows.length, save:episodeSave },
  }
}
