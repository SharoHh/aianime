const MOOD_RULES = [
  {
    key: 'evening',
    label: 'На вечер',
    words: ['вечер', 'отдох', 'уют', 'спокой', 'лёгк', 'легк', 'расслаб'],
    genres: ['Романтика', 'Повседневность', 'Комедия', 'Драма'],
    reason: 'мягкий темп, понятный вход и настроение для спокойного просмотра'
  },
  {
    key: 'dark',
    label: 'Мрачное',
    words: ['мрач', 'тёмн', 'темн', 'жёстк', 'жестк', 'кров', 'выжив'],
    genres: ['Психология', 'Триллер', 'Драма', 'Экшен', 'Сверхъестественное'],
    reason: 'тёмный тон, напряжение и сильный драматический конфликт'
  },
  {
    key: 'action',
    label: 'Экшен',
    words: ['экшен', 'драк', 'битв', 'сраж', 'динамич', 'боев'],
    genres: ['Экшен', 'Приключения', 'Сёнен', 'Фэнтези'],
    reason: 'много движения, конфликтов и зрелищных сцен'
  },
  {
    key: 'romance',
    label: 'Романтика',
    words: ['роман', 'любов', 'отношен', 'мил', 'нежн'],
    genres: ['Романтика', 'Драма', 'Повседневность'],
    reason: 'отношения, эмоциональная динамика и мягкая драматургия'
  },
  {
    key: 'smart',
    label: 'Умное',
    words: ['умн', 'психолог', 'детектив', 'интеллект', 'стратег', 'загад'],
    genres: ['Психология', 'Триллер', 'Фантастика', 'Драма'],
    reason: 'интрига, умные персонажи и смысловой конфликт'
  },
  {
    key: 'fantasy',
    label: 'Фэнтези',
    words: ['фэнтези', 'маг', 'мир', 'приключ', 'исекай'],
    genres: ['Фэнтези', 'Приключения', 'Сверхъестественное'],
    reason: 'выраженный мир, приключение и элементы фантастики'
  },
  {
    key: 'short',
    label: 'Короткое',
    words: ['коротк', 'быстр', 'выходн', 'один вечер', 'мало серий'],
    genres: [],
    reason: 'не слишком длинный формат и быстрый вход в историю'
  }
]

function asText(value){
  return String(value || '').toLowerCase()
}

function tokenize(text){
  return asText(text).split(/[^a-zа-яё0-9]+/i).map(t => t.trim()).filter(t => t.length > 2)
}

function getMoodMatches(query){
  const q = asText(query)
  return MOOD_RULES.filter(rule => rule.words.some(word => q.includes(word)))
}

function formatGenres(item){
  return Array.isArray(item?.genres) ? item.genres.filter(Boolean) : []
}

export function scoreAnimeForQuery(item, query = '', context = {}){
  const q = asText(query)
  const tokens = tokenize(q)
  const genres = formatGenres(item)
  const haystack = asText(`${item.title} ${item.originalTitle} ${item.description} ${genres.join(' ')} ${item.studio} ${item.year} ${item.status}`)
  let score = Number(item.score || item.rating || 0) * 8

  if(!q) score += Number(item.popularity || item.score || 0)

  for(const token of tokens){
    if(haystack.includes(token)) score += 10
  }

  const moodMatches = getMoodMatches(q)
  for(const rule of moodMatches){
    const genreHits = genres.filter(g => rule.genres.includes(g)).length
    score += genreHits * 18
    if(rule.key === 'short'){
      const episodes = Number(item.episodes || 0)
      if(episodes > 0 && episodes <= 13) score += 24
      if(item.kind === 'movie') score += 16
    }
    if(rule.key === 'evening'){
      const episodes = Number(item.episodes || 0)
      if(item.status === 'completed') score += 8
      if(episodes > 0 && episodes <= 24) score += 8
    }
  }

  if(context.baseAnime){
    const baseGenres = formatGenres(context.baseAnime)
    const genreOverlap = genres.filter(g => baseGenres.includes(g)).length
    score += genreOverlap * 22
    if(item.status === context.baseAnime.status) score += 5
    if(item.kind === context.baseAnime.kind) score += 5
    if(item.year && context.baseAnime.year) score += Math.max(0, 12 - Math.abs(Number(item.year) - Number(context.baseAnime.year)))
  }

  if(context.preferCompleted && item.status === 'completed') score += 8
  if(context.preferOngoing && item.status === 'ongoing') score += 8

  return Math.max(0, score)
}

export function explainAnimeMatch(item, query = '', context = {}){
  const genres = formatGenres(item).slice(0, 3)
  const moodMatches = getMoodMatches(query)
  const parts = []

  if(context.baseAnime){
    const overlap = genres.filter(g => formatGenres(context.baseAnime).includes(g))
    if(overlap.length) parts.push(`похожий набор жанров: ${overlap.join(', ')}`)
  }

  if(moodMatches.length){
    parts.push(moodMatches[0].reason)
  }

  if(genres.length) parts.push(`жанры: ${genres.join(', ')}`)
  if(Number(item.score || 0) >= 8.5) parts.push('высокий рейтинг')
  if(Number(item.episodes || 0) > 0 && Number(item.episodes || 0) <= 13) parts.push('короткий формат')

  return parts.slice(0, 3).join('; ') || 'совпадает по общему вайбу, жанрам и рейтингу.'
}

export function recommendAnime(list, query = '', options = {}){
  const safeList = Array.isArray(list) ? list : []
  const baseSlug = options.baseSlug || null
  const baseAnime = options.baseAnime || safeList.find(item => item.slug === baseSlug) || null

  return safeList
    .filter(item => !baseAnime || item.slug !== baseAnime.slug)
    .map(item => {
      const aiScore = scoreAnimeForQuery(item, query, { ...options, baseAnime })
      const match = Math.min(99, Math.max(51, Math.round(aiScore)))
      return {
        ...item,
        aiScore,
        match,
        reason: explainAnimeMatch(item, query, { ...options, baseAnime })
      }
    })
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, options.limit || 12)
}

export function getMoodPresets(){
  return MOOD_RULES.map(rule => ({ key: rule.key, label: rule.label }))
}
