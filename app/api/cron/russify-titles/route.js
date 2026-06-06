import { verifyCronAccess, cronAuthError } from '@/lib/cronAuth'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { enrichAnimeWithKodik, hasKodik } from '@/lib/kodik'

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms))
}

function clean(value){
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text || null
}

function hasCyrillic(value){
  return /[а-яё]/i.test(String(value || ''))
}

function hasLatin(value){
  return /[a-z]/i.test(String(value || ''))
}

function normalizeTitle(value){
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/&/g, ' and ')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleNeedsRu(row, force = false){
  if(force) return true
  const current = clean(row?.title_ru)
  if(!current) return true
  if(!hasCyrillic(current)) return true

  const title = clean(row?.title)
  const original = clean(row?.original_title || row?.title_orig || row?.title_orig_kodik)
  const currentNorm = normalizeTitle(current)
  if(title && currentNorm === normalizeTitle(title) && hasLatin(title)) return true
  if(original && currentNorm === normalizeTitle(original) && hasLatin(original)) return true

  return false
}

function isBadRuCandidate(value){
  const text = clean(value)
  if(!text) return true
  if(!hasCyrillic(text)) return true
  if(text.length < 2 || text.length > 140) return true

  const lower = text.toLowerCase()
  if(/ani(libria|dub|media)|anilibria|anidub|studio|субтитр|озвучк|дубляж|перевод/.test(lower)) return true
  if(/^\d+$/.test(text)) return true
  if(/^(серия|эпизод|сезон)$/i.test(text)) return true

  return false
}

function uniqueClean(values){
  const result = []
  const seen = new Set()

  for(const value of values){
    const text = clean(value)
    if(!text) continue
    const key = normalizeTitle(text)
    if(!key || seen.has(key)) continue
    seen.add(key)
    result.push(text)
  }

  return result
}

function kodikTitleCandidates(patch){
  const raw = patch?.kodik_raw || {}
  const materialData = raw?.material_data || {}
  const candidates = [
    patch?.title_ru,
    raw?.title,
    materialData?.title_ru,
    materialData?.title,
    materialData?.anime_title,
    raw?.other_title,
    patch?.other_title,
  ]

  if(Array.isArray(raw?.titles)){
    for(const item of raw.titles){
      if(typeof item === 'string') candidates.push(item)
      else candidates.push(item?.title, item?.name, item?.value)
    }
  }

  if(Array.isArray(materialData?.titles)){
    for(const item of materialData.titles){
      if(typeof item === 'string') candidates.push(item)
      else candidates.push(item?.title, item?.name, item?.value)
    }
  }

  return uniqueClean(candidates).filter(candidate => !isBadRuCandidate(candidate))
}

function detectSeasonSuffix(row){
  const text = [row?.title, row?.title_ru, row?.original_title, row?.title_orig, row?.title_orig_kodik]
    .map(clean)
    .filter(Boolean)
    .join(' ')

  const normalized = normalizeTitle(text)
  if(!normalized) return null

  const seasonMatch = normalized.match(/(?:season|сезон)\s*(\d+)/i) || normalized.match(/(\d+)(?:st|nd|rd|th)?\s*season/i)
  if(seasonMatch?.[1]) return `${seasonMatch[1]} сезон`

  const partMatch = normalized.match(/(?:part|часть)\s*(\d+)/i)
  if(partMatch?.[1]) return `${partMatch[1]} часть`

  return null
}

function applySeasonSuffix(title, row, enabled){
  const base = clean(title)
  if(!base || !enabled) return base
  const suffix = detectSeasonSuffix(row)
  if(!suffix) return base

  const normBase = normalizeTitle(base)
  const normSuffix = normalizeTitle(suffix)
  if(normBase.includes(normSuffix)) return base

  const number = suffix.match(/\d+/)?.[0]
  if(number && new RegExp(`(^|\\s)${number}(\\s|$)`).test(normBase) && /сезон|часть/i.test(normBase)) return base

  return `${base}: ${suffix}`
}

function chooseRussianTitle(patch, row, { seasonSuffix = true } = {}){
  const candidates = kodikTitleCandidates(patch)
  if(!candidates.length) return null

  // Берём самый короткий нормальный русский вариант: обычно это чистое название без лишних алиасов.
  const ranked = candidates
    .map(title => ({ title, score: title.length }))
    .sort((a, b) => a.score - b.score)

  return applySeasonSuffix(ranked[0].title, row, seasonSuffix)
}


function missingColumnFromSupabase(text){
  const raw = String(text || '')
  const quoted = raw.match(/Could not find the '([^']+)' column/i)
  if(quoted?.[1]) return quoted[1]
  const jsonMatch = raw.match(/\"message\":\"Could not find the '([^']+)' column/i)
  if(jsonMatch?.[1]) return jsonMatch[1]
  return null
}

function pickKey(row){
  if(row?.id !== null && row?.id !== undefined) return { field:'id', value:row.id }
  return { field:'slug', value:row.slug }
}

async function patchAnime(row, patch){
  const key = pickKey(row)
  const payload = { ...patch }
  const removed = []

  for(let attempt = 0; attempt < 12; attempt++){
    const res = await supabaseRequest(`anime?${key.field}=eq.${encodeURIComponent(String(key.value))}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      headers: { Prefer: 'return=minimal' },
      timeout: 12000,
    })

    if(res.ok) return { removed }

    const text = await res.text().catch(() => '')
    const missing = missingColumnFromSupabase(text)
    if(missing && Object.prototype.hasOwnProperty.call(payload, missing)){
      delete payload[missing]
      removed.push(missing)
      continue
    }

    throw new Error(`${row.slug}: anime update failed ${res.status} ${text.slice(0, 260)}`)
  }

  throw new Error(`${row.slug}: anime update failed: too many missing columns (${removed.join(', ')})`)
}

async function patchScheduleTitle(row, titleRu){
  if(!row?.slug || !titleRu) return { ok: true, skipped: true }
  const res = await supabaseRequest(`anime_schedule?anime_slug=eq.${encodeURIComponent(row.slug)}`, {
    method: 'PATCH',
    body: JSON.stringify({ title_ru: titleRu, updated_at: new Date().toISOString() }),
    headers: { Prefer: 'return=minimal' },
    timeout: 9000,
  })

  if(!res.ok){
    const text = await res.text().catch(() => '')
    return { ok: false, error: `schedule update failed ${res.status} ${text.slice(0, 220)}` }
  }

  return { ok: true }
}

async function readAnimeBatch({ limit, offset, onlyMissing }){
  const fields = [
    'id','slug','title','title_ru','original_title','title_orig','title_orig_kodik','year',
    'mal_id','shikimori_id','kodik_id','kodik_link','translation_title','rating','status'
  ].join(',')

  // Не фильтруем кириллицу на стороне PostgREST: надёжнее проверить title_ru в JS,
  // иначе разные версии PostgREST могут по-разному обработать ilike с Unicode.
  const query = `anime?select=${encodeURIComponent(fields)}&order=rating.desc.nullslast&limit=${limit}&offset=${offset}`
  const res = await supabaseRequest(query, { method: 'GET', timeout: 12000 })

  if(!res.ok){
    const text = await res.text().catch(() => '')
    throw new Error(`anime read failed: ${res.status} ${text}`)
  }

  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) ? rows : []
}

function titleSyncEnabled(req){
  return req.nextUrl.searchParams.get('enable') === '1' || process.env.ENABLE_KODIK_TITLE_RU_SYNC === '1'
}

export async function GET(req){
  const startedAt = new Date().toISOString()
  const cronAuth = verifyCronAccess(req)
  if(!cronAuth.ok) return cronAuthError(cronAuth)

  const url = req.nextUrl
  const enable = titleSyncEnabled(req)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || process.env.KODIK_TITLE_RU_LIMIT || 80), 1), 200)
  const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0)
  const delay = Math.min(Math.max(Number(url.searchParams.get('delay') || process.env.KODIK_TITLE_RU_DELAY_MS || 500), 150), 4000)
  const force = url.searchParams.get('force') === '1'
  const dryRun = url.searchParams.get('dry') === '1'
  const onlyMissing = url.searchParams.get('all') !== '1'
  const updateSchedule = url.searchParams.get('schedule') !== '0'
  const seasonSuffix = url.searchParams.get('seasonSuffix') !== '0'

  const result = {
    ok: false,
    provider: 'kodik-title-ru',
    auth: cronAuth.mode,
    requested: { enable, limit, offset, delay, force, dryRun, onlyMissing, updateSchedule, seasonSuffix },
    checked: 0,
    needsUpdate: 0,
    matched: 0,
    updated: 0,
    scheduleUpdated: 0,
    skipped: 0,
    errors: [],
    sample: [],
    startedAt,
    finishedAt: null,
  }

  try{
    if(!enable){
      return Response.json({
        ...result,
        ok: false,
        skipped: true,
        reason: 'title-ru-sync-disabled',
        hint: 'Запусти /api/cron/russify-titles?enable=1&token=CRON_SECRET. Можно dry=1 для проверки без записи.',
        finishedAt: new Date().toISOString(),
      }, { status: 200 })
    }

    if(!hasSupabase()) throw new Error('Supabase env is not configured')
    if(!hasKodik()) throw new Error('KODIK_TOKEN is not configured')

    const rows = await readAnimeBatch({ limit, offset, onlyMissing })
    result.checked = rows.length

    for(const row of rows){
      if(!titleNeedsRu(row, force)){
        result.skipped += 1
        continue
      }

      result.needsUpdate += 1

      try{
        const patch = await enrichAnimeWithKodik(row, { limit: 7 })
        const titleRu = chooseRussianTitle(patch, row, { seasonSuffix })

        if(!patch || !titleRu){
          result.skipped += 1
          if(result.sample.length < 8){
            result.sample.push({ slug: row.slug, current: row.title_ru || row.title, status: 'no-russian-kodik-title' })
          }
          await sleep(delay)
          continue
        }

        result.matched += 1

        const animePatch = {
          title_ru: titleRu,
          title_orig_kodik: patch.title_orig_kodik || row.title_orig_kodik || row.original_title || null,
          kodik_id: patch.kodik_id || row.kodik_id || undefined,
          kodik_link: patch.kodik_link || row.kodik_link || undefined,
          kodik_type: patch.kodik_type || undefined,
          translation_title: patch.translation_title || row.translation_title || undefined,
          translation_type: patch.translation_type || undefined,
          quality: patch.quality || undefined,
          kodik_screenshots: Array.isArray(patch.kodik_screenshots) ? patch.kodik_screenshots : undefined,
          updated_at: new Date().toISOString(),
        }

        Object.keys(animePatch).forEach(key => {
          if(animePatch[key] === undefined) delete animePatch[key]
        })

        if(!dryRun){
          await patchAnime(row, animePatch)
          result.updated += 1

          if(updateSchedule){
            const schedule = await patchScheduleTitle(row, titleRu)
            if(schedule.ok) result.scheduleUpdated += 1
            else result.errors.push({ slug: row.slug, title: row.title, error: schedule.error })
          }
        }

        if(result.sample.length < 8){
          result.sample.push({
            slug: row.slug,
            before: row.title_ru || row.title,
            after: titleRu,
            original: patch.title_orig_kodik || row.original_title || null,
            translation: patch.translation_title || null,
            dryRun,
          })
        }
      }catch(error){
        result.errors.push({ slug: row.slug, title: row.title, error: error?.message || String(error) })
      }

      await sleep(delay)
    }

    result.ok = result.errors.length === 0
    result.finishedAt = new Date().toISOString()
    result.hint = dryRun
      ? 'Dry-run: показаны тайтлы, для которых Kodik нашёл русское название. Для записи убери dry=1.'
      : 'Русские title_ru записаны в anime. Текущие строки anime_schedule тоже обновлены; для новых расписаний перезапусти /api/cron/schedule.'

    return Response.json(result, { status: result.errors.length ? 207 : 200 })
  }catch(error){
    result.error = error?.message || String(error)
    result.hint = 'Это отдельный cron для русификации title_ru через Kodik. Сайт и каталог не должны падать, даже если sync не прошёл.'
    result.finishedAt = new Date().toISOString()
    return Response.json(result, { status: 200 })
  }
}
