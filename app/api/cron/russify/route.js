import { verifyCronAccess, cronAuthError } from '@/lib/cronAuth'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { translateGenres, makeRussianDescription, needsRussianDescription } from '@/lib/ruContent'

function asArray(value){
  if(Array.isArray(value)) return value
  if(typeof value === 'string') return value.split(',').map(x => x.trim()).filter(Boolean)
  return []
}

function hasEnglishGenre(genres){
  return asArray(genres).some(genre => /^[A-Za-z0-9\s()'&-]+$/.test(String(genre || '').trim()))
}

function pickKey(row){
  if(row?.id !== null && row?.id !== undefined) return { field:'id', value:row.id }
  return { field:'slug', value:row.slug }
}

async function patchAnime(row, patch){
  const key = pickKey(row)
  const value = encodeURIComponent(String(key.value))
  const res = await supabaseRequest(`anime?${key.field}=eq.${value}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    headers: { Prefer: 'return=minimal' },
    timeout: 9000
  })

  if(!res.ok){
    const text = await res.text().catch(() => '')
    throw new Error(`${row.slug}: ${res.status} ${text.slice(0, 220)}`)
  }
}

export async function GET(req){
  const startedAt = new Date().toISOString()
  const cronAuth = verifyCronAccess(req)
  if(!cronAuth.ok) return cronAuthError(cronAuth)

  if(!hasSupabase()){
    return Response.json({ ok:false, error:'Supabase env is not configured' }, { status: 500 })
  }

  const url = req.nextUrl
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 200), 1), 500)
  const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0)
  const force = url.searchParams.get('force') === '1'
  const dryRun = url.searchParams.get('dry') === '1'

  const fields = [
    'id','slug','title','title_ru','original_title','title_orig','title_orig_kodik',
    'description','description_ru','genres','kind','status','year','episodes','studio','rating'
  ].join(',')

  const res = await supabaseRequest(`anime?select=${encodeURIComponent(fields)}&order=rating.desc.nullslast&limit=${limit}&offset=${offset}`, {
    method: 'GET',
    timeout: 12000
  })

  if(!res.ok){
    const text = await res.text().catch(() => '')
    return Response.json({ ok:false, error:`anime read failed: ${res.status} ${text}` }, { status: 500 })
  }

  const rows = await res.json().catch(() => [])
  const updates = []
  const errors = []

  for(const row of Array.isArray(rows) ? rows : []){
    const patch = {}
    const genresRu = translateGenres(row.genres)
    if(force || hasEnglishGenre(row.genres)) patch.genres = genresRu

    const shouldWriteDescription = force || needsRussianDescription(row.description_ru)
    if(shouldWriteDescription){
      patch.description_ru = makeRussianDescription({
        ...row,
        title: row.title_ru || row.title,
        original_title: row.title_orig_kodik || row.title_orig || row.original_title,
        genres: genresRu
      })
    }

    if(!Object.keys(patch).length) continue

    updates.push({ slug: row.slug, patch })
    if(dryRun) continue

    try{
      await patchAnime(row, patch)
    }catch(error){
      errors.push({ slug: row.slug, error: error?.message || String(error) })
    }
  }

  return Response.json({
    ok: errors.length === 0,
    provider: 'russify',
    auth: cronAuth.mode,
    requested: { limit, offset, force, dryRun },
    checked: Array.isArray(rows) ? rows.length : 0,
    planned: updates.length,
    updated: dryRun ? 0 : updates.length - errors.length,
    errors,
    sample: updates.slice(0, 5),
    hint: dryRun
      ? 'Dry-run: показано, какие русские описания и жанры будут записаны.'
      : 'Русские жанры и description_ru обновлены. UI уже показывает description_ru и переведённые жанры.',
    startedAt,
    finishedAt: new Date().toISOString()
  }, { status: errors.length ? 207 : 200 })
}
