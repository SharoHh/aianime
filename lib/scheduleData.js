import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'

const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const DAY_LONG = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
const MS_IN_DAY = 86400000

export const SCHEDULE_TIME_ZONE = process.env.AIANIME_SCHEDULE_TIME_ZONE || process.env.NEXT_PUBLIC_AIANIME_SCHEDULE_TIME_ZONE || 'Europe/Moscow'

function asDate(value){
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function partsInTimeZone(date, timeZone = SCHEDULE_TIME_ZONE){
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(asDate(date))

  const map = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  }
}

function utcDateFromParts(parts){
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
}

function dateKeyFromUtcDate(date){
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function dateKeyInTimeZone(date, timeZone = SCHEDULE_TIME_ZONE){
  return dateKeyFromUtcDate(utcDateFromParts(partsInTimeZone(date, timeZone)))
}

function mondayOfWeekInTimeZone(date, timeZone = SCHEDULE_TIME_ZONE){
  const localDate = utcDateFromParts(partsInTimeZone(date, timeZone))
  const day = localDate.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  localDate.setUTCDate(localDate.getUTCDate() + diff)
  return localDate
}

function monthNameFromUtcDate(date){
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(date).replace('.', '')
}

function formatTimeInTimeZone(value, timeZone = SCHEDULE_TIME_ZONE){
  const date = asDate(value)
  if(Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function releaseCountText(count){
  const n = Math.abs(Number(count) || 0) % 100
  const n1 = n % 10
  if(n > 10 && n < 20) return `${count} релизов`
  if(n1 > 1 && n1 < 5) return `${count} релиза`
  if(n1 === 1) return `${count} релиз`
  return `${count} релизов`
}

function episodeMeta(row){
  const episode = Number(row?.episode_number || row?.episodeNumber || 0)
  if(episode > 0) return `${episode} серия`
  if(row?.broadcast_time) return 'Новая серия'
  return 'Эфир по расписанию'
}

function isAllowedRemoteImage(url){
  try{
    const parsed = new URL(String(url || ''))
    const host = parsed.hostname.toLowerCase()
    return parsed.protocol === 'https:' && (
      host === 'cdn.myanimelist.net' ||
      host.endsWith('.myanimelist.net') ||
      host === 'i.kodikres.com' ||
      host.endsWith('.kodikres.com') ||
      host === 'shikimori.one' ||
      host.endsWith('.shikimori.one')
    )
  }catch{
    return false
  }
}

function safePoster(url, fallback = '/posters/magic2.svg'){
  const raw = String(url || '').trim()
  if(!raw) return fallback
  if(raw.startsWith('/')) return raw
  if(isAllowedRemoteImage(raw)) return `/api/image?url=${encodeURIComponent(raw)}&fallback=${encodeURIComponent(fallback)}`
  return fallback
}

function isOngoingRow(row){
  const raw = String(row?.anime_status || '').toLowerCase().trim()
  // Старые строки могли быть без anime_status, поэтому не рубим их на чтении.
  // После нового cron текущая неделя очищается и заполняется уже только онгоингами.
  return !raw || raw === 'ongoing' || raw.includes('currently airing') || raw.includes('airing')
}

function normalizeScheduleRow(row){
  if(!row || !row.airing_at || !row.anime_slug) return null
  if(row.catalog_matched === false) return null
  if(!isOngoingRow(row)) return null
  const title = row.title_ru || row.title || row.original_title || 'Аниме'
  const poster = safePoster(row.poster_url || row.poster, '/posters/magic2.svg')
  const slug = row.anime_slug || row.slug
  const airingAt = row.airing_at
  const notifyKey = row.schedule_uid || `${slug}-${airingAt}`

  return {
    id: row.id || notifyKey,
    time: formatTimeInTimeZone(airingAt) || row.broadcast_time || '—',
    title,
    meta: episodeMeta(row),
    poster,
    slug,
    href: `/anime/${slug}`,
    notifyKey,
    airingAt,
    source: row.source || 'jikan',
    sourceLabel: row.source === 'manual' ? 'ручное расписание' : 'Jikan/MAL',
  }
}

function emptyDays(now = new Date(), { timeZone = SCHEDULE_TIME_ZONE, rows = [] } = {}){
  const weekStart = mondayOfWeekInTimeZone(now, timeZone)
  const todayKey = dateKeyInTimeZone(now, timeZone)
  const byKey = new Map()

  for(const row of rows){
    const item = normalizeScheduleRow(row)
    if(!item) continue
    const key = dateKeyInTimeZone(item.airingAt, timeZone)
    if(!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(item)
  }

  const days = DAY_SHORT.map((shortName, dayIndex) => {
    const date = new Date(weekStart)
    date.setUTCDate(weekStart.getUTCDate() + dayIndex)
    const key = dateKeyFromUtcDate(date)
    const items = (byKey.get(key) || []).sort((a, b) => String(a.airingAt).localeCompare(String(b.airingAt)))

    return {
      key,
      shortName,
      name: DAY_LONG[dayIndex],
      date: String(date.getUTCDate()),
      month: monthNameFromUtcDate(date),
      isToday: key === todayKey,
      countText: releaseCountText(items.length),
      items,
    }
  })

  const todayIndex = Math.max(0, days.findIndex(day => day.isToday))

  return {
    days,
    todayIndex,
    todayItems: days[todayIndex]?.items || [],
  }
}

async function readScheduleRows({ now = new Date(), timeZone = SCHEDULE_TIME_ZONE, limit = 300 } = {}){
  if(!hasSupabase()) return { rows: [], ok: false, reason: 'supabase-disabled' }

  const weekStart = mondayOfWeekInTimeZone(now, timeZone)
  const from = new Date(weekStart.getTime() - 2 * MS_IN_DAY).toISOString()
  const to = new Date(weekStart.getTime() + 9 * MS_IN_DAY).toISOString()
  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 1000)

  const query = `anime_schedule?select=*&airing_at=gte.${encodeURIComponent(from)}&airing_at=lt.${encodeURIComponent(to)}&order=airing_at.asc&limit=${safeLimit}`

  try{
    const res = await supabaseRequest(query, { method: 'GET', timeout: 9000 })
    if(!res.ok){
      const text = await res.text().catch(() => '')
      console.warn(`AIanime schedule read skipped: ${res.status} ${text.slice(0, 160)}`)
      return { rows: [], ok: false, reason: 'table-missing-or-unavailable' }
    }
    const rows = await res.json().catch(() => [])
    return { rows: Array.isArray(rows) ? rows : [], ok: true, reason: null }
  }catch(error){
    console.warn('AIanime schedule read failed:', error?.message || error)
    return { rows: [], ok: false, reason: error?.message || 'request-failed' }
  }
}

export async function getWeeklySchedule(options = {}){
  const now = options.now || new Date()
  const timeZone = options.timeZone || SCHEDULE_TIME_ZONE
  const result = await readScheduleRows({ now, timeZone, limit: options.limit })
  const schedule = emptyDays(now, { timeZone, rows: result.rows })
  const totalItems = schedule.days.reduce((sum, day) => sum + day.items.length, 0)

  return {
    ...schedule,
    isReal: true,
    hasData: totalItems > 0,
    source: 'supabase-anime_schedule',
    timeZone,
    readOk: result.ok,
    reason: result.reason,
  }
}

// Kept for old imports. It no longer creates fake releases from the catalog.
export function buildWeeklySchedule(_anime = [], now = new Date()){
  return {
    ...emptyDays(now),
    isReal: true,
    hasData: false,
    source: 'empty-real-schedule',
    reason: 'anime_schedule-empty',
    timeZone: SCHEDULE_TIME_ZONE,
  }
}
