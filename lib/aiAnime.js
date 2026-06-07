import { scoreAiItem, explainAiMatch, isAiItemRelevant, getQueryIntent } from '@/lib/searchRelevance'
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
  return scoreAiItem(item, query, context)
}

export function explainAnimeMatch(item, query = '', context = {}){
  return explainAiMatch(item, query, context)
}

export function recommendAnime(list, query = '', options = {}){
  const safeList = Array.isArray(list) ? list : []
  const baseSlug = options.baseSlug || null
  const baseAnime = options.baseAnime || safeList.find(item => item.slug === baseSlug) || null
  const intent = getQueryIntent(query)
  const limit = options.limit || 12

  const candidates = safeList
    .filter(item => !baseAnime || item.slug !== baseAnime.slug)
    .filter(item => isAiItemRelevant(item, query))

  const pool = candidates.length >= Math.min(4, limit) ? candidates : safeList.filter(item => !baseAnime || item.slug !== baseAnime.slug)

  return pool
    .map(item => {
      const aiScore = scoreAnimeForQuery(item, query, { ...options, baseAnime })
      const matchBase = intent.strongGenreRequest ? 62 : 58
      const match = Math.min(98, Math.max(matchBase, Math.round(60 + aiScore / 18)))
      return {
        ...item,
        aiScore,
        match,
        reason: explainAnimeMatch(item, query, { ...options, baseAnime })
      }
    })
    .filter(item => Number(item.aiScore || 0) > 0)
    .sort((a, b) => b.aiScore - a.aiScore)
    .reduce((acc, item) => {
      const key = String(item.titleRu || item.title || item.slug || '')
        .toLowerCase()
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\b(tv|ova|ona|movie|season|part)\b/gi, '')
        .replace(/[0-9]+/g, '')
        .replace(/[^a-zа-яё]+/gi, ' ')
        .trim()
      if(key && acc.keys.has(key)) return acc
      if(key) acc.keys.add(key)
      acc.items.push(item)
      return acc
    }, { keys:new Set(), items:[] })
    .items
    .slice(0, limit)
}


export function getMoodPresets(){
  return MOOD_RULES.map(rule => ({ key: rule.key, label: rule.label }))
}
