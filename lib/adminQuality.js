import { getAnimeRestriction, readAnimeRestrictionState } from '@/lib/contentRestrictions'
import { isPlaceholderPoster } from '@/lib/animeQuality'

export function cleanAdminText(value){
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function hasCyrillic(value){
  return /[А-Яа-яЁё]/.test(String(value || ''))
}

export function isLatinOnly(value){
  const text = cleanAdminText(value)
  return Boolean(text && /[A-Za-z]/.test(text) && !hasCyrillic(text))
}

export function splitGenres(value){
  if(Array.isArray(value)) return value.map(item => cleanAdminText(item)).filter(Boolean)
  const text = String(value || '').trim()
  if(!text) return []
  try{
    const parsed = JSON.parse(text)
    if(Array.isArray(parsed)) return parsed.map(item => cleanAdminText(item)).filter(Boolean)
  }catch{}
  return text.split(',').map(item => cleanAdminText(item)).filter(Boolean)
}

export function isBadPosterUrl(value){
  return isPlaceholderPoster(value)
}

export function isMissingDescription(value){
  const text = cleanAdminText(value).toLowerCase()
  if(!text) return true
  if(text === '—' || text === 'default') return true
  if(text.includes('будет добавлено')) return true
  if(text.includes('описание появится')) return true
  return false
}

export function isShortDescription(value){
  const text = cleanAdminText(value)
  return !text || text.length < 140
}

export function hasEnglishGenre(value){
  return splitGenres(value).some(genre => {
    const text = cleanAdminText(genre)
    return Boolean(text && /^[A-Za-z0-9\s()'&:/.+-]+$/.test(text))
  })
}

export function hasBadSymbols(value){
  return /[●•]{2,}/.test(String(value || ''))
}

export function pickRuCandidate(row){
  const kodik = row?.kodik_raw || {}
  const material = kodik?.material_data || {}
  const raw = row?.raw || {}
  const candidates = [
    row?.title_ru,
    row?.other_title,
    row?.title_orig_kodik,
    kodik?.title,
    kodik?.other_title,
    material?.anime_title,
    material?.title,
    ...(Array.isArray(material?.other_titles) ? material.other_titles : []),
    ...(Array.isArray(raw?.titles) ? raw.titles.map(item => item?.title) : []),
  ].map(cleanAdminText).filter(Boolean)
  return candidates.find(hasCyrillic) || ''
}

export function normalizeAdminAnime(row = {}){
  const titleRu = cleanAdminText(row.title_ru)
  const title = cleanAdminText(row.title)
  const posterUrl = cleanAdminText(row.poster_url || row.poster || row.image_url)
  const bannerUrl = cleanAdminText(row.banner_url)
  const descriptionRu = cleanAdminText(row.description_ru)
  const description = cleanAdminText(row.description)
  const genres = splitGenres(row.genres)
  const kodik = row.kodik_raw || {}
  const episodes = Number(row.episodes_count || row.episodes || row.episodes_total || kodik.episodes_count || kodik.last_episode || 0) || 0
  const hasKodik = Boolean(row.kodik_id || row.kodik_url || kodik.id || kodik.link || kodik.title)
  const ruCandidate = pickRuCandidate(row)
  const restrictionState = readAnimeRestrictionState(row)
  const restriction = getAnimeRestriction(row)
  const restricted = Boolean(restriction)
  const issues = []

  if(restricted) issues.push('restricted')
  if(!titleRu) issues.push('missing_ru')
  if(isLatinOnly(titleRu)) issues.push('latin_ru')
  if(!posterUrl) issues.push('missing_poster')
  if(posterUrl && isBadPosterUrl(posterUrl)) issues.push('bad_poster')
  if(bannerUrl && isBadPosterUrl(bannerUrl)) issues.push('bad_banner')
  if(isMissingDescription(descriptionRu || description)) issues.push('missing_description')
  if(isShortDescription(descriptionRu || description)) issues.push('short_description')
  if(!genres.length) issues.push('missing_genres')
  if(hasEnglishGenre(genres)) issues.push('english_genres')
  if(hasBadSymbols(`${titleRu} ${title} ${descriptionRu} ${description}`)) issues.push('bad_symbols')
  if(!hasKodik) issues.push('missing_player')
  if(hasKodik && episodes === 1 && /(season|tv|сезон|часть)/i.test(`${title} ${titleRu}`)) issues.push('suspicious_player')

  return {
    id: row.id,
    slug: row.slug || '',
    title,
    titleRu,
    originalTitle: cleanAdminText(row.original_title),
    otherTitle: cleanAdminText(row.other_title),
    titleOrigKodik: cleanAdminText(row.title_orig_kodik),
    description,
    descriptionRu,
    posterUrl,
    bannerUrl,
    year: row.year || '',
    status: restricted ? cleanAdminText(restriction?.original_status || row.status || '') : (row.status || ''),
    dbStatus: row.status || '',
    kind: row.kind || '',
    episodes,
    rating: row.rating || row.score || '',
    studio: row.studio || '',
    genres,
    kodikId: row.kodik_id || '',
    kodikUrl: row.kodik_url || '',
    hasKodik,
    restricted,
    restrictionConfigured:restrictionState.configured,
    restriction: restriction ? { ...restriction } : null,
    ruCandidate,
    issues,
    updatedAt: row.updated_at || '',
    createdAt: row.created_at || '',
  }
}

export function issueLabel(issue){
  const labels = {
    missing_ru:'Без RU',
    latin_ru:'RU латиницей',
    missing_poster:'Без постера',
    bad_poster:'Плохой постер',
    bad_banner:'Плохой баннер',
    missing_description:'Без описания',
    short_description:'Короткое описание',
    missing_genres:'Без жанров',
    english_genres:'Англ. жанры',
    bad_symbols:'Мусор',
    missing_player:'Без плеера',
    suspicious_player:'Подозрительный плеер',
    restricted:'Закрыт в РФ',
  }
  return labels[issue] || issue
}

export function adminAnimeStats(items = []){
  const stats = {
    total: items.length,
    ready: 0,
    missing_ru: 0,
    latin_ru: 0,
    missing_poster: 0,
    bad_poster: 0,
    missing_description: 0,
    short_description: 0,
    missing_genres: 0,
    english_genres: 0,
    bad_symbols: 0,
    missing_player: 0,
    suspicious_player: 0,
    restricted: 0,
    needs_work: 0,
  }

  for(const item of items){
    const issues = Array.isArray(item.issues) ? item.issues : normalizeAdminAnime(item).issues
    if(!issues.length) stats.ready += 1
    else stats.needs_work += 1
    for(const issue of issues){
      if(stats[issue] !== undefined) stats[issue] += 1
    }
  }
  return stats
}

export function matchesAdminFilter(item, filter = 'all'){
  if(filter === 'all') return true
  if(filter === 'ready') return !item.issues?.length
  if(filter === 'needs_work') return Boolean(item.issues?.length)
  if(filter === 'bad_poster') return item.issues?.includes('bad_poster') || item.issues?.includes('bad_banner')
  return item.issues?.includes(filter)
}
