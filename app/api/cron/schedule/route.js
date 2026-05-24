import { getAnimeList } from '@/lib/animeRepository'
import { fetchJikanScheduleWeek, normalizeJikanAnime } from '@/lib/jikan'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { verifyCronAccess, cronAuthError } from '@/lib/cronAuth'

const DAY_INDEX = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
}

const DAY_RU = {
  monday: 'Понедельник',
  tuesday: 'Вторник',
  wednesday: 'Среда',
  thursday: 'Четверг',
  friday: 'Пятница',
  saturday: 'Суббота',
  sunday: 'Воскресенье',
}

function clean(value){
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text || null
}

function normalizeText(value){
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/&/g, ' and ')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugify(value, fallback = 'anime'){
  const slug = String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || fallback
}

function mondayOfWeek(date){
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = base.getDay()
  const diff = day === 0 ? -6 : 1 - day
  base.setDate(base.getDate() + diff)
  return base
}

function timezoneOffsetMinutes(timezone){
  const raw = String(timezone || '').toLowerCase()
  if(raw.includes('tokyo') || raw === 'jst' || raw.includes('japan')) return 540
  if(raw.includes('moscow') || raw === 'msk') return 180
  if(raw === 'utc' || raw === 'gmt') return 0
  return 540
}

function parseBroadcastTime(item){
  const direct = clean(item?.broadcast?.time)
  if(direct && /^\d{1,2}:\d{2}$/.test(direct)) return direct.padStart(5, '0')

  const text = clean(item?.broadcast?.string)
  const match = text?.match(/(\d{1,2}):(\d{2})/)
  if(match) return `${String(match[1]).padStart(2, '0')}:${match[2]}`

  return null
}

function airingAtForWeek(dayFilter, time, timezone, now){
  const dayIndex = DAY_INDEX[dayFilter]
  if(dayIndex === undefined || !time) return null

  const [hour, minute] = time.split(':').map(Number)
  if(!Number.isFinite(hour) || !Number.isFinite(minute)) return null

  const weekStart = mondayOfWeek(now)
  const targetDate = new Date(weekStart)
  targetDate.setDate(weekStart.getDate() + dayIndex)

  const utcMs = Date.UTC(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    hour,
    minute,
    0,
    0
  ) - timezoneOffsetMinutes(timezone) * 60 * 1000

  return new Date(utcMs).toISOString()
}

function pickPoster(item){
  const images = item?.images || {}
  return images?.webp?.large_image_url ||
    images?.jpg?.large_image_url ||
    images?.webp?.image_url ||
    images?.jpg?.image_url ||
    null
}

function isOngoingStatus(value){
  const raw = String(value || '').toLowerCase()
  return raw === 'ongoing' || raw.includes('currently airing') || raw.includes('airing') || raw === 'released'
}

function catalogStatus(value){
  const raw = String(value || '').toLowerCase().trim()
  if(raw === 'ongoing' || raw.includes('currently airing')) return 'ongoing'
  if(raw === 'released') return 'completed'
  return raw || null
}

function scheduleTitleFromCatalog(matched, item){
  return clean(matched?.titleRu) || clean(matched?.displayTitle) || clean(matched?.title) || clean(item?.title) || 'Аниме'
}

function schedulePosterFromCatalog(matched, item){
  return clean(matched?.poster) || clean(matched?.banner) || pickPoster(item) || '/posters/magic2.svg'
}


function stripMalId(row){
  const { mal_id, ...rest } = row
  return rest
}

function missingAnimeRow(item){
  const row = normalizeJikanAnime(item)
  return {
    ...row,
    status: row.status || 'ongoing',
    provider: 'jikan-schedule',
    updated_at: new Date().toISOString(),
  }
}

async function upsertMissingAnimeRows(rows){
  if(!rows.length) return { ok: true, saved: 0 }

  const unique = Array.from(new Map(rows.map(row => [String(row.mal_id || row.slug), row])).values())
  const withMal = unique.filter(row => row.mal_id)
  const withoutMal = unique.filter(row => !row.mal_id)
  let saved = 0

  if(withMal.length){
    let res = await supabaseRequest('anime?on_conflict=mal_id', {
      method: 'POST',
      body: JSON.stringify(withMal),
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      timeout: 15000,
    })

    if(!res.ok){
      // Совместимость со старой схемой без mal_id.
      res = await supabaseRequest('anime?on_conflict=shikimori_id', {
        method: 'POST',
        body: JSON.stringify(withMal.map(stripMalId)),
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        timeout: 15000,
      })
    }

    if(!res.ok){
      const text = await res.text().catch(() => '')
      return { ok: false, saved, error: `Missing anime upsert failed: ${res.status} ${text.slice(0, 260)}` }
    }

    const payload = await res.json().catch(() => [])
    saved += Array.isArray(payload) ? payload.length : withMal.length
  }

  if(withoutMal.length){
    const res = await supabaseRequest('anime?on_conflict=slug', {
      method: 'POST',
      body: JSON.stringify(withoutMal.map(stripMalId)),
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      timeout: 15000,
    })

    if(!res.ok){
      const text = await res.text().catch(() => '')
      return { ok: false, saved, error: `Missing anime slug upsert failed: ${res.status} ${text.slice(0, 260)}` }
    }

    const payload = await res.json().catch(() => [])
    saved += Array.isArray(payload) ? payload.length : withoutMal.length
  }

  return { ok: true, saved }
}

function jikanTitles(item){
  return [item?.title_english, item?.title, item?.title_japanese]
    .concat(Array.isArray(item?.titles) ? item.titles.map(x => x?.title) : [])
    .map(clean)
    .filter(Boolean)
}

function buildCatalogIndex(anime){
  const byMal = new Map()
  const byTitle = new Map()

  for(const item of Array.isArray(anime) ? anime : []){
    const malIds = [item?.malId, item?.mal_id, item?.shikimoriId, item?.shikimori_id]
      .map(Number)
      .filter(n => Number.isFinite(n) && n > 0)
    for(const id of malIds) byMal.set(String(id), item)

    const titles = [item?.title, item?.displayTitle, item?.originalTitle, item?.englishTitle, item?.titleRu]
    for(const title of titles){
      const key = normalizeText(title)
      if(key && !byTitle.has(key)) byTitle.set(key, item)
    }
  }

  return { byMal, byTitle }
}

function findCatalogAnime(jikanItem, index){
  const malId = Number(jikanItem?.mal_id)
  if(Number.isFinite(malId) && index.byMal.has(String(malId))) return index.byMal.get(String(malId))

  for(const title of jikanTitles(jikanItem)){
    const key = normalizeText(title)
    if(key && index.byTitle.has(key)) return index.byTitle.get(key)
  }

  return null
}

function normalizeScheduleRows(remoteItems, catalogAnime, now, { importMissing = false } = {}){
  const catalogIndex = buildCatalogIndex(catalogAnime)
  const rows = []
  const skipped = []
  const missingAnime = []
  const seen = new Set()

  for(const item of Array.isArray(remoteItems) ? remoteItems : []){
    const dayFilter = String(item?.__aianime_schedule_day || '').toLowerCase()
    const time = parseBroadcastTime(item)
    const timezone = clean(item?.broadcast?.timezone) || 'Asia/Tokyo'
    const airingAt = airingAtForWeek(dayFilter, time, timezone, now)
    let matched = findCatalogAnime(item, catalogIndex)
    const malId = Number(item?.mal_id)
    const remoteStatus = item?.status || item?.airing_status || ''

    if(!time || !airingAt){
      skipped.push({ title: item?.title, mal_id: item?.mal_id, reason: 'no-broadcast-time' })
      continue
    }

    // Jikan schedules can include titles that are not useful for AIanime users.
    // Keep the public schedule clean: by default we show only real catalog titles.
    if(!matched?.slug && !importMissing){
      skipped.push({ title: item?.title, mal_id: item?.mal_id, reason: 'not-in-catalog' })
      continue
    }

    if(!matched?.slug && importMissing){
      const created = missingAnimeRow(item)
      if(created?.slug){
        missingAnime.push(created)
        matched = {
          slug: created.slug,
          title: created.title,
          displayTitle: created.title,
          titleRu: null,
          poster: created.poster_url || pickPoster(item) || '/posters/magic2.svg',
          status: created.status || 'ongoing',
        }
      }
    }

    if(!matched?.slug){
      skipped.push({ title: item?.title, mal_id: item?.mal_id, reason: 'not-in-catalog' })
      continue
    }

    const matchedStatus = catalogStatus(matched.status)
    if(matchedStatus && matchedStatus !== 'ongoing'){
      skipped.push({ title: item?.title, mal_id: item?.mal_id, slug: matched.slug, reason: `catalog-status-${matchedStatus}` })
      continue
    }

    if(remoteStatus && !isOngoingStatus(remoteStatus)){
      skipped.push({ title: item?.title, mal_id: item?.mal_id, status: remoteStatus, reason: 'remote-not-ongoing' })
      continue
    }

    const slug = matched.slug
    const safeMalId = Number.isFinite(malId) && malId > 0 ? malId : null
    const dateKey = airingAt.slice(0, 10)
    const scheduleUid = `jikan:${safeMalId || slug}:${dateKey}:${time}`
    if(seen.has(scheduleUid)) continue
    seen.add(scheduleUid)

    const title = scheduleTitleFromCatalog(matched, item)

    rows.push({
      schedule_uid: scheduleUid,
      anime_slug: slug,
      mal_id: safeMalId,
      title: clean(matched.originalTitle) || clean(item?.title) || title,
      title_ru: title,
      title_orig: clean(matched.originalTitle) || clean(item?.title) || null,
      poster_url: schedulePosterFromCatalog(matched, item),
      episode_number: null,
      broadcast_day: DAY_RU[dayFilter] || dayFilter,
      broadcast_time: time,
      broadcast_timezone: timezone,
      airing_at: airingAt,
      anime_status: matchedStatus || 'ongoing',
      catalog_matched: Boolean(matched?.slug && !missingAnime.some(row => row.slug === matched.slug)),
      source: 'jikan',
      raw: item,
      updated_at: new Date().toISOString(),
    })
  }

  return { rows, skipped, missingAnime }
}

async function upsertScheduleRows(rows){
  if(!rows.length) return { ok: true, saved: 0 }

  const res = await supabaseRequest('anime_schedule?on_conflict=schedule_uid', {
    method: 'POST',
    body: JSON.stringify(rows),
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    timeout: 15000,
  })

  if(!res.ok){
    const text = await res.text().catch(() => '')
    return { ok: false, saved: 0, error: `Supabase schedule upsert failed: ${res.status} ${text.slice(0, 300)}` }
  }

  const saved = await res.json().catch(() => [])
  return { ok: true, saved: Array.isArray(saved) ? saved.length : rows.length }
}

async function deleteOldRows(now){
  const cutoff = new Date(now.getTime() - 10 * 86400000).toISOString()
  try{
    const res = await supabaseRequest(`anime_schedule?source=eq.jikan&airing_at=lt.${encodeURIComponent(cutoff)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
      timeout: 9000,
    })
    return { ok: res.ok, status: res.status }
  }catch(error){
    return { ok: false, error: error?.message || String(error) }
  }
}

async function deleteVisibleWeekRows(now){
  const weekStart = mondayOfWeek(now)
  const from = new Date(weekStart.getTime() - 2 * 86400000).toISOString()
  const to = new Date(weekStart.getTime() + 9 * 86400000).toISOString()
  try{
    const res = await supabaseRequest(`anime_schedule?source=eq.jikan&airing_at=gte.${encodeURIComponent(from)}&airing_at=lt.${encodeURIComponent(to)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
      timeout: 12000,
    })
    return { ok: res.ok, status: res.status, from, to }
  }catch(error){
    return { ok: false, error: error?.message || String(error), from, to }
  }
}

function scheduleSyncEnabled(req){
  return req.nextUrl.searchParams.get('enable') === '1' || process.env.ENABLE_JIKAN_SCHEDULE_SYNC === '1'
}

export async function GET(req){
  const startedAt = new Date()
  const cronAuth = verifyCronAccess(req)
  if(!cronAuth.ok) return cronAuthError(cronAuth)

  const enable = scheduleSyncEnabled(req)
  if(!enable){
    return Response.json({
      ok: false,
      skipped: true,
      reason: 'schedule-sync-disabled',
      hint: 'Запусти /api/cron/schedule?enable=1&token=CRON_SECRET или добавь ENABLE_JIKAN_SCHEDULE_SYNC=1.',
    }, { status: 200 })
  }

  if(!hasSupabase()){
    return Response.json({
      ok: false,
      skipped: true,
      reason: 'supabase-disabled',
      hint: 'Для реального расписания нужны NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY и ENABLE_SUPABASE_RUNTIME=1.',
    }, { status: 200 })
  }

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit') || 25), 1), 25)
  const pagesPerDay = Math.min(Math.max(Number(req.nextUrl.searchParams.get('pages') || 1), 1), 4)
  const delay = Number(req.nextUrl.searchParams.get('delay') || process.env.JIKAN_SCHEDULE_DELAY_MS || 900)
  const now = startedAt
  const importMissing = req.nextUrl.searchParams.get('importMissing') === '1'

  try{
    const [remoteItems, catalogAnime] = await Promise.all([
      fetchJikanScheduleWeek({ limit, pagesPerDay, delay }),
      getAnimeList({ limit: 1200 }),
    ])

    const normalized = normalizeScheduleRows(remoteItems, catalogAnime, now, { importMissing })
    const weekCleanup = await deleteVisibleWeekRows(now)
    const animeImport = await upsertMissingAnimeRows(normalized.missingAnime)
    if(!animeImport.ok){
      return Response.json({ ok: false, source: 'jikan-schedules', animeImport, hint: 'Не удалось добавить новые тайтлы из расписания в anime. Проверь схему Supabase.' }, { status: 500 })
    }
    const database = await upsertScheduleRows(normalized.rows)
    const cleanup = await deleteOldRows(now)
    const finishedAt = new Date().toISOString()

    return Response.json({
      ok: Boolean(database.ok),
      source: 'jikan-schedules',
      requested: { limit, pagesPerDay, delay, importMissing },
      catalogCount: Array.isArray(catalogAnime) ? catalogAnime.length : 0,
      remoteCount: Array.isArray(remoteItems) ? remoteItems.length : 0,
      matched: normalized.rows.length,
      saved: database.saved,
      importedMissingAnime: animeImport.saved,
      skipped: normalized.skipped.length,
      skippedSample: normalized.skipped.slice(0, 10),
      animeImport,
      database,
      cleanup,
      weekCleanup,
      auth: cronAuth.mode,
      startedAt: startedAt.toISOString(),
      finishedAt,
      hint: database.ok
        ? 'Расписание сохранено: только онгоинги, которые есть в каталоге AIanime. Для принудительного импорта новых MAL-тайтлов добавь importMissing=1.'
        : 'Проверь, что применена миграция supabase/anime_schedule_migration.sql.',
    }, { status: database.ok ? 200 : 500 })
  }catch(error){
    return Response.json({
      ok: false,
      source: 'jikan-schedules',
      error: error?.message || String(error),
      hint: 'Сайт не упал: расписание останется пустым/старым, пока cron не сможет получить Jikan и записать Supabase.',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
    }, { status: 500 })
  }
}
