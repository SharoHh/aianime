const CYR_TO_LAT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
}

const LAT_TO_CYR_HINTS = [
  ['shingeki', 'атака титанов'], ['kyojin', 'титаны'], ['frieren', 'фрирен'], ['sousou', 'фрирен'],
  ['hagane', 'стальной алхимик'], ['renkinjutsushi', 'алхимик'], ['hunter', 'охотник'], ['gintama', 'гинтама'],
  ['chainsaw', 'человек бензопила'], ['one piece', 'ван пис'], ['naruto', 'наруто'], ['bleach', 'блич'],
  ['jujutsu', 'магическая битва'], ['kimetsu', 'клинок рассекающий демонов'], ['demon slayer', 'клинок демонов'],
  ['death note', 'тетрадь смерти'], ['steins', 'врата штейна'], ['gate', 'врата'], ['solo leveling', 'поднятие уровня'],
  ['oshinoko', 'звездное дитя'], ['oshi no ko', 'звездное дитя']
]

const STATUS_ALIASES = {
  ongoing: ['онгоинг', 'онгоинги', 'выходит', 'сейчас выходит', 'новые серии', 'airing'],
  completed: ['завершено', 'закончено', 'полностью', 'вышло полностью', 'completed'],
  movie: ['фильм', 'movie', 'полнометражка', 'полнометражный'],
  tv: ['сериал', 'tv', 'тв']
}

const GENRE_ALIASES = [
  ['Комедия', ['комедия', 'комед', 'смешное', 'смешной', 'веселое', 'весёлое', 'ржач', 'юмор', 'ромком']],
  ['Повседневность', ['повседневность', 'лайф', 'slice', 'slice of life', 'уютное', 'спокойное']],
  ['Романтика', ['романтика', 'романтик', 'романтическое', 'любовь', 'отношения', 'милое', 'лавстори', 'love story', 'ромком', 'сёдзё', 'седзе', 'шодзе']],
  ['Экшен', ['экшен', 'боевик', 'боевка', 'боёвка', 'драки', 'битвы', 'сражения', 'динамичное']],
  ['Приключения', ['приключения', 'путешествие', 'авантюра']],
  ['Фэнтези', ['фэнтези', 'магия', 'магический', 'исекай', 'иной мир']],
  ['Психология', ['психология', 'психологическое', 'умное', 'mind game']],
  ['Триллер', ['триллер', 'напряженное', 'напряжённое', 'саспенс']],
  ['Драма', ['драма', 'драматичное', 'слезы', 'слёзы', 'эмоциональное']],
  ['Детектив', ['детектив', 'расследование', 'загадка', 'тайна']],
  ['Спорт', ['спорт', 'спортивное', 'соревнования']],
  ['Музыка', ['музыка', 'музыкальное', 'группа', 'айдолы']],
  ['Школа', ['школа', 'школьное', 'старшая школа']],
  ['Сёнен', ['сенен', 'сёнен', 'shounen', 'shonen']],
  ['Сэйнэн', ['сейнен', 'сэйнэн', 'seinen']],
  ['Ужасы', ['ужасы', 'хоррор', 'страшное']],
  ['Сверхъестественное', ['сверхъестественное', 'демоны', 'духи', 'призраки']]
]

const POSITIVE_WORDS = ['легк', 'легк', 'лёгк', 'позитив', 'добро', 'добрый', 'весел', 'весёл', 'смеш', 'комед', 'уют', 'спокой', 'расслаб', 'хорошего настроения', 'мил', 'тепл', 'тёпл']
const DARK_WORDS = ['мрач', 'темн', 'тёмн', 'жестк', 'жёстк', 'кров', 'выжив', 'страш', 'хоррор', 'ужас', 'триллер']
const HEAVY_WORDS = ['смерт', 'убий', 'кров', 'войн', 'жесток', 'трагед', 'титан', 'бессмерт', 'демон', 'ужас', 'психолог', 'триллер', 'апокалип', 'месть']
const LIGHT_SAFE_GENRES = ['Комедия', 'Повседневность', 'Романтика', 'Школа', 'Музыка']
const HEAVY_GENRES = ['Ужасы', 'Триллер', 'Психология', 'Драма', 'Экшен', 'Сверхъестественное']

const RELATED_GENRE_FALLBACKS = {
  'Романтика': ['Романтика', 'Комедия', 'Повседневность', 'Школа', 'Драма'],
  'Комедия': ['Комедия', 'Повседневность', 'Романтика', 'Школа'],
  'Школа': ['Школа', 'Комедия', 'Романтика', 'Повседневность', 'Драма'],
  'Повседневность': ['Повседневность', 'Комедия', 'Романтика', 'Школа'],
  'Экшен': ['Экшен', 'Приключения', 'Сёнен', 'Фэнтези'],
  'Фэнтези': ['Фэнтези', 'Приключения', 'Сверхъестественное', 'Исекай'],
  'Психология': ['Психология', 'Триллер', 'Драма', 'Детектив'],
  'Триллер': ['Триллер', 'Психология', 'Детектив', 'Драма'],
  'Драма': ['Драма', 'Романтика', 'Повседневность', 'Психология'],
}

function relatedGenresFor(genres = []){
  const out = new Set()
  genres.forEach(genre => {
    out.add(genre)
    ;(RELATED_GENRE_FALLBACKS[genre] || []).forEach(g => out.add(g))
  })
  return Array.from(out)
}

export function normalizeSearchText(value = ''){
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[●◆■□•◦]/g, ' ')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function transliterateRuToLat(value = ''){
  return normalizeSearchText(value).split('').map(ch => CYR_TO_LAT[ch] ?? ch).join('').replace(/\s+/g, ' ').trim()
}

export function tokenizeSearch(value = ''){
  const normalized = normalizeSearchText(value)
  const tokens = normalized.split(' ').filter(token => token.length > 1)
  return Array.from(new Set(tokens))
}

function queryVariants(query = ''){
  const normalized = normalizeSearchText(query)
  const variants = new Set([normalized])
  const translit = transliterateRuToLat(query)
  if(translit) variants.add(translit)
  for(const [latin, ru] of LAT_TO_CYR_HINTS){
    if(normalized.includes(latin)) variants.add(normalizeSearchText(`${normalized} ${ru}`))
  }
  return Array.from(variants).filter(Boolean)
}

export function getItemSearchText(item = {}){
  const genres = Array.isArray(item.genres) ? item.genres.join(' ') : ''
  const raw = [
    item.title,
    item.titleRu,
    item.displayTitle,
    item.originalTitle,
    item.englishTitle,
    item.description,
    item.descriptionRu,
    item.studio,
    item.year,
    item.status,
    item.kind,
    item.meta,
    item.slug,
    genres
  ].filter(Boolean).join(' ')
  return `${normalizeSearchText(raw)} ${transliterateRuToLat(raw)}`.trim()
}

function hasNegatedAlias(q, alias){
  const a = normalizeSearchText(alias)
  if(!a) return false
  return q.includes(`без ${a}`)
    || q.includes(`не ${a}`)
    || q.includes(`не хочу ${a}`)
    || q.includes(`не надо ${a}`)
    || q.includes(`исключи ${a}`)
}

function genreHitsFromQuery(query = ''){
  const q = normalizeSearchText(query)
  const hits = []
  for(const [genre, aliases] of GENRE_ALIASES){
    if(aliases.some(alias => q.includes(normalizeSearchText(alias)) && !hasNegatedAlias(q, alias))) hits.push(genre)
  }
  return hits
}

function isStrongGenreRequest(query = '', wantedGenres = []){
  const q = normalizeSearchText(query)
  if(!wantedGenres.length) return false
  if(q.includes('похож') || q.includes('как ') || q.includes('в стиле')) return false
  return q.includes('жанр')
    || q.includes('аниме')
    || q.includes('хочу')
    || q.includes('подбери')
    || q.includes('посоветуй')
    || q.includes('нужно')
    || wantedGenres.some(genre => q.includes(normalizeSearchText(genre)))
}

function hasAnyWantedGenre(item, wantedGenres = []){
  if(!wantedGenres.length) return true
  const itemGenres = Array.isArray(item?.genres) ? item.genres : []
  return itemGenres.some(g => wantedGenres.includes(g))
}

export function getQueryIntent(query = ''){
  const q = normalizeSearchText(query)
  const tokens = tokenizeSearch(q)
  const wantedGenres = genreHitsFromQuery(q)
  const excludedGenres = []
  const excludedWords = []

  for(const [genre, aliases] of GENRE_ALIASES){
    for(const alias of aliases){
      const a = normalizeSearchText(alias)
      if(hasNegatedAlias(q, alias)){
        excludedGenres.push(genre)
        excludedWords.push(a)
      }
    }
  }

  const light = POSITIVE_WORDS.some(word => q.includes(normalizeSearchText(word)))
  const dark = DARK_WORDS.some(word => q.includes(normalizeSearchText(word)))
  const short = q.includes('коротк') || q.includes('мало серий') || q.includes('один вечер') || q.includes('на вечер')
  const noHeavy = q.includes('без жест') || q.includes('без тяжел') || q.includes('без тяж') || q.includes('не тяжел') || q.includes('не тяж') || q.includes('без драмы') || q.includes('без крови') || q.includes('без смерт')

  const uniqueExcludedGenres = Array.from(new Set(excludedGenres))
  const uniqueWantedGenres = Array.from(new Set(wantedGenres)).filter(genre => !uniqueExcludedGenres.includes(genre))

  return {
    raw: q,
    tokens,
    variants: queryVariants(query),
    wantedGenres: uniqueWantedGenres,
    strongGenreRequest: isStrongGenreRequest(q, uniqueWantedGenres),
    excludedGenres: uniqueExcludedGenres,
    excludedWords: Array.from(new Set(excludedWords)),
    wantsOngoing: STATUS_ALIASES.ongoing.some(x => q.includes(normalizeSearchText(x))),
    wantsCompleted: STATUS_ALIASES.completed.some(x => q.includes(normalizeSearchText(x))),
    wantsMovie: STATUS_ALIASES.movie.some(x => q.includes(normalizeSearchText(x))),
    wantsTv: STATUS_ALIASES.tv.some(x => q.includes(normalizeSearchText(x))),
    light,
    dark,
    short,
    noHeavy,
  }
}

function itemHasGenre(item, genres){
  const itemGenres = Array.isArray(item.genres) ? item.genres : []
  return itemGenres.some(g => genres.includes(g))
}

function itemHasRelatedGenre(item, genres){
  if(!genres?.length) return true
  return itemHasGenre(item, relatedGenresFor(genres))
}

function itemIsHardOpposite(item, intent){
  const genres = Array.isArray(item?.genres) ? item.genres : []
  if(intent.wantedGenres.includes('Романтика') && !genres.includes('Романтика')){
    if(['Экшен','Ужасы','Триллер','Психология','Сверхъестественное'].some(g => genres.includes(g))) return true
  }
  if((intent.light || intent.noHeavy) && itemHeavySignals(item) > 55 && !itemHasGenre(item, LIGHT_SAFE_GENRES)) return true
  return false
}

function itemHeavySignals(item){
  const text = getItemSearchText(item)
  const genres = Array.isArray(item.genres) ? item.genres : []
  let value = 0
  value += genres.filter(g => HEAVY_GENRES.includes(g)).length * 10
  for(const word of HEAVY_WORDS){
    if(text.includes(normalizeSearchText(word))) value += 10
  }
  return value
}

export function scoreCatalogItem(item, query = ''){
  const intent = getQueryIntent(query)
  if(!intent.raw) return Number(item.score || item.rating || 0) + Number(item.popularity || 0) / 100

  const hay = getItemSearchText(item)
  const titleText = getItemSearchText({ title: item.title, titleRu: item.titleRu, originalTitle: item.originalTitle, englishTitle: item.englishTitle, slug: item.slug })
  const genres = Array.isArray(item.genres) ? item.genres : []
  let score = 0

  for(const variant of intent.variants){
    if(!variant) continue
    if(titleText.includes(variant)) score += 80
    else if(hay.includes(variant)) score += 45
  }

  for(const token of intent.tokens){
    if(titleText.includes(token)) score += 24
    else if(hay.includes(token)) score += 8
  }

  const wantedOverlap = intent.wantedGenres.filter(genre => genres.includes(genre))
  for(const genre of intent.wantedGenres){
    if(genres.includes(genre)) score += intent.strongGenreRequest ? 90 : 38
  }
  if(intent.strongGenreRequest && intent.wantedGenres.length && !wantedOverlap.length) score -= 180

  if(intent.wantsOngoing && item.status === 'ongoing') score += 28
  if(intent.wantsCompleted && item.status === 'completed') score += 22
  if(intent.wantsMovie && item.kind === 'movie') score += 26
  if(intent.wantsTv && item.kind === 'tv') score += 12
  if(intent.short && (Number(item.episodes || 0) <= 13 || item.kind === 'movie')) score += 16

  if(intent.excludedGenres.length && itemHasGenre(item, intent.excludedGenres)) score -= 50
  if(intent.light || intent.noHeavy){
    if(itemHasGenre(item, LIGHT_SAFE_GENRES)) score += 18
    score -= itemHeavySignals(item) * (intent.noHeavy ? 1.2 : 0.75)
  }
  if(intent.dark && itemHeavySignals(item)) score += Math.min(35, itemHeavySignals(item) / 2)

  score += Number(item.score || item.rating || 0) * 1.5
  return score
}

export function filterAndSortAnime(items = [], query = '', filters = {}, sort = 'popular'){
  const text = String(query || '').trim()
  const scored = items
    .filter(item => {
      return (!filters.genre || filters.genre === 'all' || (item.genres || []).includes(filters.genre))
        && (!filters.status || filters.status === 'all' || item.status === filters.status)
        && (!filters.kind || filters.kind === 'all' || item.kind === filters.kind)
        && (!filters.year || filters.year === 'all' || String(item.year) === String(filters.year))
    })
    .map(item => ({ item, searchScore: scoreCatalogItem(item, text) }))
    .filter(x => !text || x.searchScore > 8)

  scored.sort((a, b) => {
    if(text && b.searchScore !== a.searchScore) return b.searchScore - a.searchScore
    if(sort === 'rating') return Number(b.item.score) - Number(a.item.score)
    if(sort === 'newest') return Number(b.item.year) - Number(a.item.year)
    if(sort === 'episodes') return Number(b.item.episodes) - Number(a.item.episodes)
    return Number(b.item.score) * 100 + Number(b.item.popularity || 0) - (Number(a.item.score) * 100 + Number(a.item.popularity || 0))
  })

  return scored.map(x => x.item)
}

export function scoreAiItem(item, query = '', context = {}){
  const intent = getQueryIntent(query)
  const genres = Array.isArray(item.genres) ? item.genres : []
  const ratingScore = Number(item.score || item.rating || 0) || 0
  const popularityScore = Number(item.popularity || 0) || 0
  let score = ratingScore * 5 + Math.log1p(Math.max(0, popularityScore)) * 3.5
  score += scoreCatalogItem(item, query) * 1.35

  if(!intent.raw) score += Number(item.score || 0)

  const wantedOverlap = intent.wantedGenres.filter(genre => genres.includes(genre))
  for(const genre of intent.wantedGenres){
    if(genres.includes(genre)) score += intent.strongGenreRequest ? 120 : 42
  }
  if(intent.strongGenreRequest && intent.wantedGenres.length && !wantedOverlap.length){
    score -= itemHasRelatedGenre(item, intent.wantedGenres) ? 85 : 240
  }

  if(intent.strongGenreRequest && intent.wantedGenres.length && itemHasRelatedGenre(item, intent.wantedGenres) && !wantedOverlap.length){
    score += 28
  }

  if(intent.wantedGenres.includes('Романтика')){
    if(genres.includes('Романтика')) score += 90
    else if(itemHasGenre(item, ['Комедия','Повседневность','Школа','Драма'])) score += 12
    if(!genres.includes('Романтика')) score -= 70
    if(['Экшен','Ужасы','Триллер','Психология'].some(g => genres.includes(g)) && !genres.includes('Романтика')) score -= 180
  }

  if(intent.light){
    if(itemHasGenre(item, LIGHT_SAFE_GENRES)) score += 34
    if(genres.includes('Комедия')) score += 22
    if(genres.includes('Повседневность')) score += 22
    if(genres.includes('Романтика')) score += 12
    score -= itemHeavySignals(item) * 1.6
    if(Number(item.episodes || 0) > 80) score -= 18
  }

  if(intent.noHeavy){
    score -= itemHeavySignals(item) * 2
  }

  if(intent.dark){
    score += Math.min(60, itemHeavySignals(item))
  }

  if(intent.short){
    const episodes = Number(item.episodes || 0)
    if(item.kind === 'movie') score += 28
    if(episodes > 0 && episodes <= 13) score += 32
    if(episodes > 24) score -= 24
  }

  if(intent.wantsOngoing && item.status === 'ongoing') score += 26
  if(intent.wantsCompleted && item.status === 'completed') score += 22
  if(intent.wantsMovie && item.kind === 'movie') score += 24

  if(context.baseAnime){
    const baseGenres = Array.isArray(context.baseAnime.genres) ? context.baseAnime.genres : []
    const overlap = genres.filter(g => baseGenres.includes(g)).length
    score += overlap * 28
    if(item.status === context.baseAnime.status) score += 6
    if(item.kind === context.baseAnime.kind) score += 6
    if(item.year && context.baseAnime.year) score += Math.max(0, 12 - Math.abs(Number(item.year) - Number(context.baseAnime.year)))
  }

  if(context.preferCompleted && item.status === 'completed') score += 8
  if(context.preferOngoing && item.status === 'ongoing') score += 8

  return Math.max(0, score)
}

export function isAiItemRelevant(item, query = ''){
  const intent = getQueryIntent(query)
  if(intent.excludedGenres.length && itemHasGenre(item, intent.excludedGenres)) return false
  if(itemIsHardOpposite(item, intent)) return false
  if(intent.strongGenreRequest && intent.wantedGenres.length && !hasAnyWantedGenre(item, intent.wantedGenres) && !itemHasRelatedGenre(item, intent.wantedGenres)) return false
  if(intent.light || intent.noHeavy){
    if(itemHeavySignals(item) > 55 && !itemHasGenre(item, LIGHT_SAFE_GENRES)) return false
  }
  return true
}

export function isAiItemExactMatch(item, query = ''){
  const intent = getQueryIntent(query)
  if(intent.excludedGenres.length && itemHasGenre(item, intent.excludedGenres)) return false
  if(itemIsHardOpposite(item, intent)) return false
  if(intent.strongGenreRequest && intent.wantedGenres.length) return hasAnyWantedGenre(item, intent.wantedGenres)
  return isAiItemRelevant(item, query)
}

export function explainAiMatch(item, query = '', context = {}){
  const intent = getQueryIntent(query)
  const genres = Array.isArray(item.genres) ? item.genres.filter(Boolean) : []
  const parts = []

  if(context.baseAnime){
    const overlap = genres.filter(g => (context.baseAnime.genres || []).includes(g))
    if(overlap.length) parts.push(`похожий набор жанров: ${overlap.slice(0, 3).join(', ')}`)
  }

  if(intent.light){
    if(itemHasGenre(item, LIGHT_SAFE_GENRES)) parts.push('лёгкий вайб без лишней тяжести')
    else parts.push('ближе к спокойному просмотру по общему настроению')
  }else if(intent.dark){
    parts.push('мрачный тон и напряжение')
  }else if(intent.short){
    parts.push('удобный формат для быстрого просмотра')
  }else if(intent.wantedGenres.length){
    const overlap = genres.filter(g => intent.wantedGenres.includes(g))
    if(overlap.length) parts.push(`точно попадает в запрос: ${overlap.join(', ')}`)
    else if(itemHasRelatedGenre(item, intent.wantedGenres)) parts.push('близко по вайбу и соседним жанрам')
  }

  if(genres.length) parts.push(`жанры: ${genres.slice(0, 3).join(', ')}`)
  if(Number(item.score || 0) >= 8.5) parts.push('высокий рейтинг')
  if(Number(item.episodes || 0) > 0 && Number(item.episodes || 0) <= 13) parts.push('короткий формат')

  return parts.slice(0, 3).join('; ') || 'совпадает по общему вайбу, жанрам и рейтингу.'
}

export function getCatalogHint(query = ''){
  const intent = getQueryIntent(query)
  if(!intent.raw) return 'Попробуй название, жанр, студию, год или настроение.'
  if(intent.strongGenreRequest && intent.wantedGenres.length) return `Сначала ищем точные совпадения: ${intent.wantedGenres.join(', ')}. Если их мало — добавляем близкие по вайбу, но режем совсем мимо запроса.`
  if(intent.light) return 'Для лёгких запросов понижаем тяжёлую драму, триллеры и жёсткий экшен.'
  if(intent.short) return 'Для коротких запросов выше поднимаются фильмы и тайтлы до 13 серий.'
  if(intent.wantsOngoing) return 'Показываем тайтлы, которые сейчас выходят.'
  return 'Ищем по русским и английским названиям, жанрам, описанию, студии и slug.'
}
