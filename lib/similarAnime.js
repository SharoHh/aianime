import { normalizeSearchText } from '@/lib/searchRelevance'

const GENERIC_GENRES = new Set(['Аниме', 'Сёнен', 'Сэйнэн', 'Сёдзё', 'Детское', 'Лауреаты премий'])
const HARD_TYPE_MISMATCH_PENALTY = 170

function safeGenres(item = {}){
  return Array.isArray(item.genres) ? item.genres.filter(Boolean).map(String) : []
}

function meaningfulGenres(item = {}){
  return safeGenres(item).filter(genre => !GENERIC_GENRES.has(genre))
}

function titleFamilyKey(item = {}){
  const raw = [item.titleRu, item.title, item.displayTitle, item.originalTitle, item.englishTitle, item.slug]
    .filter(Boolean)
    .join(' ')
  return normalizeSearchText(raw)
    .replace(/\b(tv|ova|ona|movie|season|part|фильм|сезон|часть|спешл|special|финал|final)\b/gi, ' ')
    .replace(/\d+/g, ' ')
    .split(' ')
    .filter(token => token.length > 2)
    .slice(0, 3)
    .join(' ')
}

function normalizedKind(kind){
  const text = String(kind || '').toLowerCase()
  if(text.includes('movie') || text.includes('film') || text === 'фильм') return 'movie'
  if(text.includes('ova')) return 'ova'
  if(text.includes('ona')) return 'ona'
  return 'tv'
}

function statusGroup(status){
  const text = String(status || '').toLowerCase()
  if(text === 'ongoing' || text.includes('airing')) return 'ongoing'
  if(text === 'anons' || text.includes('anons')) return 'anons'
  return 'completed'
}

function numeric(value){
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function overlap(a = [], b = []){
  const set = new Set(a)
  return b.filter(item => set.has(item))
}

function textContainsAny(text = '', words = []){
  const normalized = normalizeSearchText(text)
  return words.some(word => normalized.includes(normalizeSearchText(word)))
}

function themeSignals(item = {}){
  const genres = safeGenres(item)
  const text = [item.title, item.titleRu, item.originalTitle, item.englishTitle, item.description, item.descriptionRu, item.slug].filter(Boolean).join(' ')
  return {
    adventureTeam: genres.includes('Приключения') || textContainsAny(text, ['команда', 'друзья', 'путешествие', 'турнир', 'гильдия', 'пираты', 'охотник']),
    dark: genres.some(g => ['Психология', 'Триллер', 'Ужасы', 'Драма'].includes(g)) || textContainsAny(text, ['мрач', 'смерт', 'война', 'месть', 'выжив', 'страх']),
    romanceSchool: genres.includes('Романтика') || genres.includes('Школа') || textContainsAny(text, ['отношения', 'любовь', 'школа']),
    fantasyPower: genres.includes('Фэнтези') || genres.includes('Сверхъестественное') || textContainsAny(text, ['маг', 'демон', 'сила', 'мир']),
  }
}

function signalOverlapScore(base, candidate){
  const a = themeSignals(base)
  const b = themeSignals(candidate)
  let score = 0
  for(const key of Object.keys(a)){
    if(a[key] && b[key]) score += 34
  }
  return score
}

function similarReason(base, candidate, commonGenres = []){
  const baseKind = normalizedKind(base.kind)
  const candidateKind = normalizedKind(candidate.kind)
  if(commonGenres.length >= 2) return `Общее по вайбу: ${commonGenres.slice(0, 3).join(', ')}.`
  if(commonGenres.length === 1) return `Близко по ключевому жанру: ${commonGenres[0]}.`
  const baseSignals = themeSignals(base)
  const candidateSignals = themeSignals(candidate)
  if(baseSignals.adventureTeam && candidateSignals.adventureTeam) return 'Похожий упор на путь, команду и приключение.'
  if(baseSignals.dark && candidateSignals.dark) return 'Похожая тяжёлая атмосфера и напряжение.'
  if(baseSignals.romanceSchool && candidateSignals.romanceSchool) return 'Близкая школьная/романтическая динамика.'
  if(baseSignals.fantasyPower && candidateSignals.fantasyPower) return 'Близкий фэнтези-вайб и тема силы.'
  if(baseKind === candidateKind) return baseKind === 'movie' ? 'Тоже полнометражный формат.' : 'Тоже сериальный формат.'
  return 'Похож по общему настроению и аудитории.'
}

export function getSimilarAnime(baseAnime = {}, list = [], limit = 6){
  const source = Array.isArray(list) ? list.filter(item => item?.slug && item.slug !== baseAnime?.slug) : []
  if(!baseAnime?.slug || !source.length) return []

  const baseGenres = meaningfulGenres(baseAnime)
  const baseKind = normalizedKind(baseAnime.kind)
  const baseStatus = statusGroup(baseAnime.status)
  const baseFamily = titleFamilyKey(baseAnime)
  const baseEpisodes = numeric(baseAnime.episodes)
  const baseYear = numeric(baseAnime.year)

  const scored = source.map(candidate => {
    const candidateGenres = meaningfulGenres(candidate)
    const commonGenres = overlap(baseGenres, candidateGenres)
    const candidateKind = normalizedKind(candidate.kind)
    const candidateStatus = statusGroup(candidate.status)
    const candidateEpisodes = numeric(candidate.episodes)
    const candidateYear = numeric(candidate.year)
    let score = 0

    score += commonGenres.length * 125
    if(commonGenres.length >= 2) score += 90
    if(commonGenres.length >= 3) score += 65
    score += signalOverlapScore(baseAnime, candidate)

    if(candidateKind === baseKind) score += 58
    else if(baseKind === 'tv' && candidateKind === 'movie') score -= HARD_TYPE_MISMATCH_PENALTY
    else score -= 55

    if(candidateStatus === baseStatus) score += 16
    if(baseEpisodes && candidateEpisodes){
      const ratio = Math.min(baseEpisodes, candidateEpisodes) / Math.max(baseEpisodes, candidateEpisodes)
      score += Math.round(ratio * 46)
      if(baseEpisodes >= 50 && candidateEpisodes <= 13) score -= 90
      if(baseEpisodes <= 13 && candidateEpisodes > 50) score -= 50
    }
    if(baseYear && candidateYear) score += Math.max(0, 24 - Math.abs(baseYear - candidateYear) / 1.8)

    const rating = numeric(candidate.score || candidate.sourceScore || candidate.rating)
    const popularity = numeric(candidate.popularity)
    score += Math.min(22, rating * 2.4)
    score += Math.min(18, Math.log1p(Math.max(0, popularity)) * 1.6)

    const family = titleFamilyKey(candidate)
    if(baseFamily && family && baseFamily === family) score += 46
    if(!commonGenres.length) score -= 70

    return {
      item:{
        ...candidate,
        similarReason: similarReason(baseAnime, candidate, commonGenres),
        similarMatch: Math.max(0, Math.min(99, Math.round(60 + score / 8)))
      },
      score,
      commonGenres,
      family
    }
  })
    .filter(row => row.score > 25)
    .sort((a,b) => b.score - a.score)

  const selected = []
  const familyCounts = new Map()
  for(const row of scored){
    const family = row.family || row.item.slug
    const count = familyCounts.get(family) || 0
    if(count >= 1 && selected.length >= 3) continue
    selected.push(row.item)
    familyCounts.set(family, count + 1)
    if(selected.length >= limit) break
  }

  if(selected.length < limit){
    for(const row of scored){
      if(selected.some(item => item.slug === row.item.slug)) continue
      selected.push(row.item)
      if(selected.length >= limit) break
    }
  }

  return selected.slice(0, limit)
}
