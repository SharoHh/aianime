import { recommendAnime } from '@/lib/aiAnime'
import { scoreAiItem, explainAiMatch, getQueryIntent } from '@/lib/searchRelevance'

const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini'
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite'
const OPENAI_TIMEOUT_MS = Math.min(Number(process.env.OPENAI_RECOMMEND_TIMEOUT_MS || process.env.AI_RECOMMEND_TIMEOUT_MS || 4500), 6500)
const GEMINI_TIMEOUT_MS = Math.min(Number(process.env.GEMINI_RECOMMEND_TIMEOUT_MS || process.env.AI_RECOMMEND_TIMEOUT_MS || 4500), 6500)
const OPENAI_CANDIDATE_LIMIT = Math.min(Math.max(Number(process.env.OPENAI_RECOMMEND_CANDIDATES || process.env.AI_RECOMMEND_CANDIDATES || 16), 12), 20)
const EXTERNAL_AI_TIMEOUT_MS = Math.min(Number(process.env.AI_RECOMMEND_TIMEOUT_MS || process.env.EXTERNAL_AI_TIMEOUT_MS || 4200), 5200)
const EXTERNAL_AI_429_COOLDOWN_MS = Math.min(Math.max(Number(process.env.AI_RECOMMEND_429_COOLDOWN_MS || 10 * 60 * 1000), 60 * 1000), 30 * 60 * 1000)
const EXTERNAL_AI_COOLDOWN = globalThis.__aianimeExternalAiCooldown || { until: 0, status: null, reason: '' }
globalThis.__aianimeExternalAiCooldown = EXTERNAL_AI_COOLDOWN

function truncateText(value = '', limit = 240){
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if(text.length <= limit) return text
  return `${text.slice(0, limit - 1).trim()}…`
}

function cleanTitle(item){
  return String(item?.titleRu || item?.displayTitle || item?.title || item?.originalTitle || 'Без названия').trim()
}

function normalizeAiText(value = ''){
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, '')
    .trim()
}



const QUERY_TOPIC_HINTS = [
  {
    id: 'trans-gender-identity',
    aliases: ['транс', 'трансгендер', 'трансгендерный', 'транс персонаж', 'транс герой', 'гендерная идентичность', 'смена пола', 'gender identity', 'transgender'],
    titleTargets: ['hourou musuko', 'wandering son', 'блуждающий сын', 'tokyo godfathers', 'токийские крестные', 'skip to loafer', 'skip and loafer', 'zombieland saga', 'paradise kiss'],
    textTargets: ['трансгендер', 'гендерная идентичность', 'gender identity', 'transgender', 'cross-dressing', 'кроссдрессинг'],
    genres: ['Драма', 'Повседневность', 'Психология', 'Сёдзё', 'Сэйнэн'],
    note: 'Пользователь ищет тему трансгендерности/гендерной идентичности. Если точного тайтла в candidates нет, честно скажи, что это ближайшие варианты, не выдумывай транс-персонажей.'
  },
  {
    id: 'otaku-main-character',
    aliases: ['отаку', 'задрот', 'геймер', 'хикикомори', 'анимешник', 'реинкарнация безработного', 'главный герой отаку', 'главный герой настоящий отаку'],
    titleTargets: ['mushoku tensei', 'реинкарнация безработного', 'nhk ni youkoso', 'welcome to the nhk', 'genshiken', 'wotakoi', 'no game no life', 're:zero', 're zero', 'steins gate'],
    textTargets: ['отаку', 'хикикомори', 'геймер', 'игры', 'реинкарнация', 'попаданец'],
    genres: ['Комедия', 'Драма', 'Игры', 'Фэнтези', 'Приключения'],
    note: 'Пользователь ищет тайтлы про отаку/хикикомори/геймера или попаданца.'
  },
  {
    id: 'overpowered-main-character',
    aliases: ['гг имба', 'имба гг', 'сильный гг', 'самый сильный гг', 'главный герой имба', 'overpowered', 'op mc'],
    titleTargets: ['solo leveling', 'поднятие уровня в одиночку', 'one punch man', 'ванпанчмен', 'mob psycho', 'mob psycho 100', 'overlord', 'tensura', 'slime', 'mashle'],
    textTargets: ['самый сильный', 'непобедимый', 'overpowered', 'ранг', 'уровень'],
    genres: ['Экшен', 'Фэнтези', 'Приключения', 'Сёнен', 'Игры'],
    note: 'Пользователь ищет аниме с очень сильным главным героем.'
  },
  {
    id: 'isekai-reincarnation',
    aliases: ['исекай', 'попаданец', 'попал в другой мир', 'реинкарнация', 'перерождение', 'другой мир'],
    titleTargets: ['mushoku tensei', 're:zero', 're zero', 'tensura', 'slime', 'overlord', 'konosuba', 'no game no life', 'rezero'],
    textTargets: ['исекай', 'попаданец', 'реинкарнация', 'перерождение', 'другой мир'],
    genres: ['Фэнтези', 'Приключения', 'Комедия', 'Экшен'],
    note: 'Пользователь ищет исекай/попаданца/реинкарнацию.'
  },
  {
    id: 'dark-psychological',
    aliases: ['мрачное', 'жесткое', 'психологическое', 'психология', 'триллер', 'страшное', 'кровь', 'маньяк', 'безумие'],
    titleTargets: ['monster', 'монстр', 'death note', 'тетрадь смерти', 'steins gate', 'serial experiments lain', 'lain', 'parasyte', 'another', 'tokyo ghoul', 'made in abyss'],
    textTargets: ['психология', 'триллер', 'детектив', 'жестокость', 'ужасы', 'безумие'],
    genres: ['Психология', 'Триллер', 'Драма', 'Детектив', 'Ужасы'],
    note: 'Пользователь ищет мрачный психологический триллер/жесть.'
  }
]

function getQueryTopicHints(query = ''){
  const normalizedQuery = normalizeAiText(query)
  if(!normalizedQuery) return []
  return QUERY_TOPIC_HINTS.filter(hint =>
    hint.aliases.some(alias => {
      const normalizedAlias = normalizeAiText(alias)
      return normalizedAlias && normalizedQuery.includes(normalizedAlias)
    })
  )
}

function queryWords(value = ''){
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length >= 3)
}

function compactWordSet(value = ''){
  return new Set(queryWords(value).filter(word => !['аниме','мультик','главный','герой','героиня','хочу','найди','покажи','где','про','как','типа','что','есть','чтоб','чтобы'].includes(word)))
}

function candidateSearchBlob(item = {}){
  return [
    item?.slug,
    item?.titleRu,
    item?.displayTitle,
    item?.title,
    item?.originalTitle,
    item?.englishTitle,
    item?.descriptionRu,
    item?.description,
    ...(Array.isArray(item?.genres) ? item.genres : [])
  ].map(value => String(value || '')).join(' ')
}

function textOverlapBoost(item = {}, query = ''){
  const words = Array.from(compactWordSet(query))
  if(!words.length) return 0
  const blobWords = compactWordSet(candidateSearchBlob(item))
  if(!blobWords.size) return 0
  let hits = 0
  for(const word of words){
    if(blobWords.has(word)) hits += 1
  }
  const ratio = hits / Math.max(1, words.length)
  if(!hits) return 0
  return Math.round(hits * 95 + ratio * 220)
}

function topicHintBoost(item = {}, hints = []){
  if(!hints.length) return 0
  const titleBlob = getTitleAliases(item).map(normalizeAiText).join(' ')
  const slug = normalizeAiText(item?.slug || '')
  const description = normalizeAiText(`${item?.descriptionRu || ''} ${item?.description || ''}`)
  const genres = getCandidateGenres(item).map(normalizeAiText)
  let boost = 0

  for(const hint of hints){
    const targetHit = (hint.titleTargets || []).some(target => {
      const normalizedTarget = normalizeAiText(target)
      return normalizedTarget && (titleBlob.includes(normalizedTarget) || slug.includes(normalizedTarget))
    })
    const textHit = (hint.textTargets || []).some(target => {
      const normalizedTarget = normalizeAiText(target)
      return normalizedTarget && (description.includes(normalizedTarget) || titleBlob.includes(normalizedTarget) || slug.includes(normalizedTarget))
    })
    const genreHitCount = (hint.genres || []).filter(genre => genres.includes(normalizeAiText(genre))).length

    if(targetHit) boost += 1450
    if(textHit) boost += 520
    if(genreHitCount) boost += genreHitCount * 75
  }

  return boost
}


function detectHumanQueryTone(query = ''){
  const q = normalizeAiText(query)
  return {
    exactName: q.length > 0 && q.length <= 28,
    dark: ['мрач','жест','кров','психолог','триллер','хоррор','безум','слом','депресс'].some(x => q.includes(normalizeAiText(x))),
    light: ['легк','лёгк','уют','спокой','мил','добро','чил','расслаб'].some(x => q.includes(normalizeAiText(x))),
    romance: ['роман','любов','отношен','влюб','пара'].some(x => q.includes(normalizeAiText(x))),
    otaku: ['отаку','геймер','хикикомори','задрот','анимешник'].some(x => q.includes(normalizeAiText(x))),
    isekai: ['исекай','попадан','другоймир','реинкарн','перерожд'].some(x => q.includes(normalizeAiText(x))),
    overpowered: ['ггимба','имбагг','сильныйгг','самыйсильный','overpowered','opmc'].some(x => q.includes(normalizeAiText(x))),
    team: ['команд','друз','экипаж','пати','отряд'].some(x => q.includes(normalizeAiText(x)))
  }
}

function genreWordsForReason(item = {}){
  return getCandidateGenres(item)
    .filter(Boolean)
    .filter(genre => !['Лауреаты премий','Сёнен','Сэйнэн','Сёдзё'].includes(String(genre)))
    .slice(0, 2)
}

function humanReasonForItem(item = {}, query = ''){
  const title = cleanTitle(item)
  const original = String(item?.originalTitle || item?.englishTitle || '').trim()
  const tone = detectHumanQueryTone(query)
  const genres = genreWordsForReason(item)
  const genreTail = genres.length ? ` По ощущениям это ${genres.join(' + ').toLowerCase()}.` : ''

  if(tone.otaku){
    if(/wotaku|отаку/i.test(`${title} ${original} ${item?.slug || ''}`)) return 'Прямое попадание в запрос: здесь не просто гик-вайб, а взрослая история людей, которые реально живут отаку-культурой.'
    if(/no game no life|нет игры/i.test(`${title} ${original}`)) return 'Подходит, если под “отаку” ты имел в виду геймеров, стратегию и героев, которые мыслят как задроты.'
    if(/mushoku|реинкарнация безработного/i.test(`${title} ${original}`)) return 'Бывший закрытый отаку получает второй шанс в другом мире — запрос попадает не по жанру, а по типажу героя.'
  }

  if(tone.overpowered) return 'Здесь кайф именно в ощущении силы: герой быстро давит правила мира и тащит сюжет своим уровнем.'
  if(tone.isekai) return 'Это про побег в другой мир: новые правила, прокачка, опасности и ощущение “начать жизнь заново”.'
  if(tone.team) return 'Хорошо ложится на запрос про команду: не одинокий герой, а путь, где важны союзники и общая цель.'
  if(tone.dark) return `Подойдёт, если хочется не просто экшен, а напряжение, внутренний надлом и тяжёлую атмосферу.${genreTail}`
  if(tone.romance) return `Попадает в настроение отношений: здесь важны химия персонажей, неловкость и эмоциональное притяжение.${genreTail}`
  if(tone.light) return `Это вариант без лишнего груза: мягкий темп, уют и ощущение, что можно просто выдохнуть.${genreTail}`

  if(genres.length) return `Похоже на то, что ты описал: у тайтла близкий вайб и понятная связка ${genres.join(' + ').toLowerCase()}.`
  return 'Выбрал это как ближайшее совпадение по смыслу запроса, а не просто по одному слову в названии.'
}

function cleanModelReason(reason = '', item = {}, query = ''){
  const text = truncateText(reason, 220)
  const normalized = normalizeAiText(text)
  const templateLike = !text
    || normalized.includes(normalizeAiText('жанры:'))
    || normalized.includes(normalizeAiText('подходит по жанрам'))
    || normalized.includes(normalizeAiText('короткий формат для быстрого просмотра'))
    || normalized.includes(normalizeAiText('удобный формат'))
    || normalized.length < 20
  if(templateLike) return humanReasonForItem(item, query)
  return text
}

const QUERY_ENTITY_HINTS = [
  {
    id: 'tokyo-ghoul-kaneki',
    aliases: ['канеки', 'кен канеки', 'кэн канеки', 'kaneki', 'ken kaneki'],
    titleTargets: ['токийский гуль', 'tokyo ghoul', 'tokyo kushu', 'toukyou kushu'],
    textTargets: ['канеки', 'гуль', 'ghoul'],
    genres: ['Ужасы', 'Экшен', 'Психология', 'Драма', 'Сверхъестественное'],
    note: 'Канеки — персонаж из «Токийского гуля», поэтому тайтлы Tokyo Ghoul должны быть вверху.'
  },
  {
    id: 'one-piece-luffy',
    aliases: ['луффи', 'luffy', 'манки д луффи', 'monkey d luffy'],
    titleTargets: ['ван пис', 'ван-пис', 'one piece'],
    textTargets: ['луффи', 'luffy', 'пират'],
    genres: ['Приключения', 'Экшен', 'Сёнен', 'Фэнтези'],
    note: 'Луффи — персонаж из «Ван-Пис».'
  },
  {
    id: 'naruto-characters',
    aliases: ['наруто', 'naruto', 'саске', 'sasuke', 'итачи', 'itachi', 'какаши', 'kakashi'],
    titleTargets: ['наруто', 'naruto'],
    textTargets: ['шиноби', 'ниндзя'],
    genres: ['Экшен', 'Приключения', 'Сёнен'],
    note: 'Запрос про персонажей Naruto должен поднимать Naruto/Naruto Shippuuden.'
  },
  {
    id: 'aot-eren',
    aliases: ['эрен', 'eren', 'йегер', 'егер', 'yeager', 'jaeger'],
    titleTargets: ['атака титанов', 'attack on titan', 'shingeki no kyojin'],
    textTargets: ['титан', 'titan'],
    genres: ['Экшен', 'Драма', 'Триллер'],
    note: 'Эрен — персонаж из «Атаки титанов».'
  },
  {
    id: 'demon-slayer-tanjiro',
    aliases: ['танджиро', 'танжиро', 'tanjiro', 'незуко', 'nezuko'],
    titleTargets: ['клинок рассекающий демонов', 'kimetsu no yaiba', 'demon slayer'],
    textTargets: ['демон', 'demons'],
    genres: ['Экшен', 'Сёнен', 'Сверхъестественное'],
    note: 'Танджиро/Незуко — персонажи из «Клинка, рассекающего демонов».'
  },
  {
    id: 'death-note-light',
    aliases: ['лайт ягами', 'light yagami', 'яга́ми', 'ягами', 'рюк', 'ryuk'],
    titleTargets: ['тетрадь смерти', 'death note'],
    textTargets: ['детектив', 'психология'],
    genres: ['Психология', 'Триллер', 'Детектив'],
    note: 'Лайт/Рюк/L — персонажи из «Тетради смерти».'
  }
]

function getQueryEntityHints(query = ''){
  const normalizedQuery = normalizeAiText(query)
  if(!normalizedQuery) return []
  return QUERY_ENTITY_HINTS.filter(hint =>
    hint.aliases.some(alias => {
      const normalizedAlias = normalizeAiText(alias)
      return normalizedAlias && normalizedQuery.includes(normalizedAlias)
    })
  )
}

function entityHintBoost(item = {}, hints = []){
  if(!hints.length) return 0
  const titleBlob = getTitleAliases(item).map(normalizeAiText).join(' ')
  const slug = normalizeAiText(item?.slug || '')
  const description = normalizeAiText(`${item?.descriptionRu || ''} ${item?.description || ''}`)
  const genres = getCandidateGenres(item).map(normalizeAiText)
  let boost = 0

  for(const hint of hints){
    const targetHit = hint.titleTargets.some(target => {
      const normalizedTarget = normalizeAiText(target)
      return normalizedTarget && (titleBlob.includes(normalizedTarget) || slug.includes(normalizedTarget))
    })
    const textHit = hint.textTargets.some(target => {
      const normalizedTarget = normalizeAiText(target)
      return normalizedTarget && (description.includes(normalizedTarget) || titleBlob.includes(normalizedTarget) || slug.includes(normalizedTarget))
    })
    const genreHitCount = hint.genres.filter(genre => genres.includes(normalizeAiText(genre))).length

    if(targetHit) boost += 2600
    if(textHit) boost += 650
    if(genreHitCount) boost += genreHitCount * 90
  }

  return boost
}

function getTitleAliases(item = {}){
  return [
    item?.titleRu,
    item?.displayTitle,
    item?.title,
    item?.originalTitle,
    item?.englishTitle
  ]
    .map(value => String(value || '').trim())
    .filter(Boolean)
}

function titleMatchBoost(item = {}, query = ''){
  const normalizedQuery = normalizeAiText(query)
  if(!normalizedQuery || normalizedQuery.length < 3) return 0
  let boost = 0
  for(const alias of getTitleAliases(item)){
    const normalizedAlias = normalizeAiText(alias)
    if(!normalizedAlias || normalizedAlias.length < 3) continue
    if(normalizedQuery === normalizedAlias) boost = Math.max(boost, 1800)
    else if(normalizedQuery.includes(normalizedAlias) || normalizedAlias.includes(normalizedQuery)) boost = Math.max(boost, 1350)
  }
  return boost
}

function isLikelyRealCatalogItem(item = {}){
  const slug = String(item?.slug || '')
  const poster = String(item?.poster || item?.image || '')
  if(/^\d+-/.test(slug)) return true
  if(poster.startsWith('/api/image?url=')) return true
  if(Number(item?.malId || item?.mal_id || item?.shikimoriId || item?.shikimori_id || 0) > 0) return true
  return false
}

function duplicateCandidateKey(item = {}){
  const aliases = getTitleAliases(item)
    .map(normalizeAiText)
    .filter(value => value && value.length >= 3 && !/^animeseed\d+$/.test(value))
  return aliases[0] || String(item?.slug || '').toLowerCase()
}

function catalogQualityScore(item = {}){
  let score = 0
  const slug = String(item?.slug || '')
  const poster = String(item?.poster || item?.image || '')
  if(/^\d+-/.test(slug)) score += 180
  if(poster.startsWith('/api/image?url=')) score += 80
  if(Number(item?.episodes || 0) > 0) score += 25
  if(Number(item?.sourceScore || item?.score || item?.rating || 0) > 0) score += 20
  if(isSeedCatalogItem(item)) score -= 1000
  return score
}


function isSeedCatalogItem(item = {}){
  const slug = String(item?.slug || '').trim().toLowerCase()
  const originalTitle = String(item?.originalTitle || item?.englishTitle || '').trim()
  const title = String(item?.titleRu || item?.displayTitle || item?.title || '').trim()
  if(/^catalog-title-\d+$/.test(slug)) return true
  if(/^anime seed\s*\d+$/i.test(originalTitle)) return true
  if(/^anime seed\s*\d+$/i.test(title)) return true
  return false
}

function compactCandidate(item, query, index){
  const genres = Array.isArray(item?.genres) ? item.genres.filter(Boolean).slice(0, 3) : []
  return {
    n: index + 1,
    slug: String(item?.slug || ''),
    title: cleanTitle(item),
    originalTitle: String(item?.originalTitle || item?.englishTitle || '').trim() || null,
    year: item?.year || null,
    episodes: Number(item?.episodes || 0) || null,
    genres,
    localScore: Math.round(Number(item?.aiScore || scoreAiItem(item, query) || 0)),
    localReason: truncateText(humanReasonForItem(item, query), 90)
  }
}

function parseOpenAiText(data){
  if(data?.output_text) return String(data.output_text)
  const parts = []
  for(const item of data?.output || []){
    for(const content of item?.content || []){
      if(content?.type === 'output_text' && content?.text) parts.push(content.text)
      if(typeof content?.text === 'string') parts.push(content.text)
    }
  }
  return parts.join('\n').trim()
}

function parseJsonPayload(text){
  const raw = String(text || '').trim()
  if(!raw) return null
  try{ return JSON.parse(raw) }catch{}
  const match = raw.match(/\{[\s\S]*\}/)
  if(match){
    try{ return JSON.parse(match[0]) }catch{}
  }
  return null
}


function parseGeminiText(data){
  const parts = []
  for(const candidate of data?.candidates || []){
    for(const part of candidate?.content?.parts || []){
      if(typeof part?.text === 'string') parts.push(part.text)
    }
  }
  return parts.join('\n').trim()
}

function getConfiguredProvider(){
  const raw = String(process.env.AI_PROVIDER || process.env.AI_RECOMMEND_PROVIDER || '').trim().toLowerCase()
  if(['local','none','off','disabled','0'].includes(raw)) return 'local'
  if(['openai','gpt','chatgpt'].includes(raw)) return 'openai'
  if(['gemini','google','google-gemini','google_ai'].includes(raw)) return 'gemini'
  if(String(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '').trim()) return 'gemini'
  if(String(process.env.OPENAI_API_KEY || '').trim()) return 'openai'
  return 'local'
}

function getProviderModel(provider){
  if(provider === 'gemini'){
    return String(process.env.GEMINI_MODEL || process.env.GOOGLE_AI_MODEL || DEFAULT_GEMINI_MODEL).trim()
  }
  if(provider === 'openai'){
    return String(process.env.OPENAI_MODEL || process.env.OPENAI_API_MODEL || DEFAULT_OPENAI_MODEL).trim()
  }
  return null
}

function getGeminiApiKey(){
  return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '').trim()
}

function geminiModelPath(model){
  return String(model || DEFAULT_GEMINI_MODEL).trim().replace(/^models\//, '')
}

function localPayload(summary, localFallback, meta = {}){
  return {
    source: 'local',
    model: null,
    summary,
    results: localFallback,
    openai: { enabled:false, provider:'local', ...meta }
  }
}

function makeFallbackResults(candidates, query, limit){
  return candidates.slice(0, limit).map(item => ({
    ...item,
    match: Math.min(96, Math.max(60, Math.round(item.match || 60 + Number(item.aiScore || 0) / 18))),
    reason: cleanModelReason(item.reason, item, query)
  }))
}

function getRequestContext(options = {}){
  const context = options.context && typeof options.context === 'object' ? options.context : {}
  const library = Array.isArray(context.library) ? context.library : []
  const favorites = Array.isArray(context.favorites) ? context.favorites : []
  return {
    library: library.slice(0, 80).map(row => ({
      slug: String(row?.slug || '').trim(),
      status: String(row?.status || '').trim()
    })).filter(row => row.slug),
    favorites: favorites.slice(0, 80).map(slug => String(slug || '').trim()).filter(Boolean)
  }
}

function getCandidateGenres(item = {}){
  return Array.isArray(item?.genres) ? item.genres.filter(Boolean).map(String) : []
}

const AI_RELATED_GENRES = {
  'Романтика': ['Романтика', 'Комедия', 'Школа', 'Повседневность', 'Драма', 'Сёдзё', 'Седзе'],
  'Комедия': ['Комедия', 'Романтика', 'Школа', 'Повседневность'],
  'Школа': ['Школа', 'Романтика', 'Комедия', 'Повседневность', 'Драма'],
  'Повседневность': ['Повседневность', 'Комедия', 'Романтика', 'Школа'],
  'Экшен': ['Экшен', 'Приключения', 'Сёнен', 'Фэнтези'],
  'Фэнтези': ['Фэнтези', 'Приключения', 'Сверхъестественное', 'Экшен'],
  'Психология': ['Психология', 'Триллер', 'Драма', 'Детектив'],
  'Триллер': ['Триллер', 'Психология', 'Детектив', 'Драма'],
  'Драма': ['Драма', 'Романтика', 'Повседневность', 'Психология']
}

function relatedGenresForCandidatePool(wanted = []){
  const out = new Set()
  for(const genre of wanted){
    out.add(genre)
    ;(AI_RELATED_GENRES[genre] || []).forEach(g => out.add(g))
  }
  return Array.from(out)
}

function hasAnyGenre(item, genres = []){
  if(!genres.length) return false
  const itemGenres = getCandidateGenres(item)
  return itemGenres.some(g => genres.includes(g))
}

function candidatePoolScore(item, query, intent, entityHints = [], topicHints = []){
  const genres = getCandidateGenres(item)
  let score = Number(scoreAiItem(item, query) || 0)
  score += titleMatchBoost(item, query)
  score += catalogQualityScore(item)
  score += entityHintBoost(item, entityHints)
  score += topicHintBoost(item, topicHints)
  score += textOverlapBoost(item, query)

  const wantedOverlap = intent.wantedGenres.filter(genre => genres.includes(genre)).length
  const relatedOverlap = relatedGenresForCandidatePool(intent.wantedGenres).filter(genre => genres.includes(genre)).length

  if(wantedOverlap) score += wantedOverlap * 220
  if(relatedOverlap) score += relatedOverlap * 48

  if(intent.light){
    if(hasAnyGenre(item, ['Комедия', 'Романтика', 'Школа', 'Повседневность', 'Музыка'])) score += 85
    if(hasAnyGenre(item, ['Ужасы', 'Триллер', 'Психология']) && !hasAnyGenre(item, ['Романтика', 'Комедия'])) score -= 160
  }

  if(intent.short){
    const episodes = Number(item?.episodes || 0)
    if(item?.kind === 'movie') score += 45
    if(episodes > 0 && episodes <= 13) score += 65
    if(episodes > 24) score -= 45
  }

  if(intent.excludedGenres.length && hasAnyGenre(item, intent.excludedGenres)) score -= 300
  score += Number(item?.sourceScore || item?.score || item?.rating || 0) * 8
  return score
}

function decorateCandidate(item, query, intent, entityHints = [], topicHints = []){
  const score = candidatePoolScore(item, query, intent, entityHints, topicHints)
  return {
    ...item,
    aiScore: score,
    reason: cleanModelReason(item?.reason, item, query)
  }
}

function buildCandidatePool(list, query, options = {}){
  const safeList = Array.isArray(list) ? list.filter(item => item?.slug && !isSeedCatalogItem(item)) : []
  const baseSlug = options.baseSlug || null
  const requestedLimit = Number(options.limit || 12)
  // Gemini должен отвечать быстро: кандидатов мало, JSON короткий, если не успел — отдаём локальный подбор.
  const limit = Math.min(
    Math.max(OPENAI_CANDIDATE_LIMIT, requestedLimit * 2, 12),
    20
  )
  const intent = getQueryIntent(query)
  const entityHints = getQueryEntityHints(query)
  const topicHints = getQueryTopicHints(query)
  const related = relatedGenresForCandidatePool(intent.wantedGenres)
  const bySlug = new Map()

  function prepared(items = [], reasonBoost = 0){
    return items
      .filter(item => item?.slug && item.slug !== baseSlug)
      .map(item => {
        const decorated = decorateCandidate(item, query, intent, entityHints, topicHints)
        return {
          ...decorated,
          aiScore: Number(decorated.aiScore || 0) + reasonBoost
        }
      })
      .sort((a,b) => Number(b.aiScore || 0) - Number(a.aiScore || 0))
  }

  const byTitle = new Map()

  function add(items = [], maxAdd = limit){
    for(const item of items){
      if(!item?.slug || item.slug === baseSlug || bySlug.has(item.slug)) continue

      const duplicateKey = duplicateCandidateKey(item)
      const existingSlug = byTitle.get(duplicateKey)
      if(existingSlug && bySlug.has(existingSlug)){
        const existing = bySlug.get(existingSlug)
        const currentScore = Number(item.aiScore || 0) + catalogQualityScore(item)
        const existingScore = Number(existing.aiScore || 0) + catalogQualityScore(existing)
        if(currentScore > existingScore){
          bySlug.delete(existingSlug)
          bySlug.set(item.slug, item)
          byTitle.set(duplicateKey, item.slug)
        }
        continue
      }

      bySlug.set(item.slug, item)
      byTitle.set(duplicateKey, item.slug)
      if(bySlug.size >= maxAdd || bySlug.size >= limit) break
    }
  }

  // 0) Персонажи и кривые пользовательские названия: "канеки" => Tokyo Ghoul.
  // Это должно попадать в кандидаты ДО жанров, иначе Gemini выбирает просто похожий вайб.
  if(entityHints.length){
    const targetTitles = entityHints.flatMap(hint => hint.titleTargets || []).map(normalizeAiText).filter(Boolean)
    const textTargets = entityHints.flatMap(hint => hint.textTargets || []).map(normalizeAiText).filter(Boolean)
    add(prepared(
      safeList.filter(item => {
        const titleBlob = getTitleAliases(item).map(normalizeAiText).join(' ')
        const slug = normalizeAiText(item?.slug || '')
        const description = normalizeAiText(`${item?.descriptionRu || ''} ${item?.description || ''}`)
        return targetTitles.some(target => titleBlob.includes(target) || slug.includes(target))
          || textTargets.some(target => titleBlob.includes(target) || slug.includes(target) || description.includes(target))
      }),
      1800
    ), Math.min(limit, 6))
  }

  // 0.5) Широкие тематические подсказки для тупых/кривых запросов:
  // "канеки", "отаку", "транс", "гг имба", "попаданец" и похожее.
  // Это не заменяет Gemini, а даёт ему правильные варианты из каталога.
  if(topicHints.length){
    const targetTitles = topicHints.flatMap(hint => hint.titleTargets || []).map(normalizeAiText).filter(Boolean)
    const textTargets = topicHints.flatMap(hint => hint.textTargets || []).map(normalizeAiText).filter(Boolean)
    const topicGenres = topicHints.flatMap(hint => hint.genres || [])
    add(prepared(
      safeList.filter(item => {
        const titleBlob = getTitleAliases(item).map(normalizeAiText).join(' ')
        const slug = normalizeAiText(item?.slug || '')
        const description = normalizeAiText(`${item?.descriptionRu || ''} ${item?.description || ''}`)
        return targetTitles.some(target => titleBlob.includes(target) || slug.includes(target))
          || textTargets.some(target => titleBlob.includes(target) || slug.includes(target) || description.includes(target))
          || hasAnyGenre(item, topicGenres)
      }),
      950
    ), Math.min(limit, 8))
  }

  // 0.6) Текстовый поиск по названию/описанию/жанрам из самого запроса.
  // Нужен, чтобы любой странный запрос не сваливался в случайные популярные тайтлы.
  add(prepared(
    safeList.filter(item => textOverlapBoost(item, query) > 0),
    520
  ), Math.min(limit, 10))

  // 1) Самые точные совпадения по нескольким жанрам: например Романтика + Школа.
  if(intent.wantedGenres.length > 1){
    add(prepared(
      safeList.filter(item => {
        const genres = getCandidateGenres(item)
        return intent.wantedGenres.every(genre => genres.includes(genre))
      }),
      420
    ), Math.min(limit, 8))
  }

  // 2) Любой точный жанр из запроса. Не режем до одного результата.
  if(intent.wantedGenres.length){
    add(prepared(
      safeList.filter(item => hasAnyGenre(item, intent.wantedGenres)),
      300
    ), Math.min(limit, 10))
  }

  // 3) Соседние жанры по вайбу: романтика -> комедия/школа/повседневность/драма.
  if(related.length){
    add(prepared(
      safeList.filter(item => hasAnyGenre(item, related)),
      140
    ), Math.min(limit, 14))
  }

  // 4) Лёгкий запрос: дополнительно даём модели безопасные лёгкие варианты.
  if(intent.light || intent.noHeavy){
    add(prepared(
      safeList.filter(item => hasAnyGenre(item, ['Комедия', 'Романтика', 'Школа', 'Повседневность', 'Музыка'])),
      90
    ), Math.min(limit, 16))
  }

  // 5) Короткий формат: фильмы и тайтлы до 13 серий.
  if(intent.short){
    add(prepared(
      safeList.filter(item => item?.kind === 'movie' || (Number(item?.episodes || 0) > 0 && Number(item?.episodes || 0) <= 13)),
      70
    ), Math.min(limit, 18))
  }

  // 6) Старый локальный подбор оставляем как сигнал, но не позволяем ему сжать выборку до одного тайтла.
  add(prepared(recommendAnime(safeList, query, { ...options, limit: Math.min(limit, 18) }), 60), Math.min(limit, 20))

  // 7) Финальная страховка: всегда добираем широкую витрину из всего каталога.
  // Пусть GPT выбирает умно из 100+ кандидатов, а не из одной Кагуи.
  add(prepared(safeList, 0), limit)

  let rows = Array.from(bySlug.values()).filter(item => item?.slug)

  // Убираем совсем противопоказанные варианты, но только если после этого остаётся нормальная витрина.
  const filtered = rows.filter(item => {
    if(intent.excludedGenres.length && hasAnyGenre(item, intent.excludedGenres)) return false
    if(intent.light || intent.noHeavy){
      if(hasAnyGenre(item, ['Ужасы', 'Триллер', 'Психология']) && !hasAnyGenre(item, ['Романтика','Комедия','Школа','Повседневность'])) return false
    }
    return true
  })
  if(filtered.length >= Math.min(12, requestedLimit * 2)) rows = filtered

  rows.sort((a,b) => Number(b.aiScore || 0) - Number(a.aiScore || 0))
  return rows.slice(0, limit)
}

function mergeModelResults(parsed, candidatePool, query, limit, provider = 'ai'){
  const bySlug = new Map(candidatePool.filter(item => !isSeedCatalogItem(item)).map(item => [String(item.slug), item]))
  const used = new Set()
  const rows = Array.isArray(parsed?.results) ? parsed.results : []
  const selected = []

  for(const row of rows){
    const slug = String(row?.slug || '').trim()
    if(!slug || used.has(slug) || !bySlug.has(slug)) continue
    const item = bySlug.get(slug)
    used.add(slug)
    selected.push({
      ...item,
      aiScore: Number(item.aiScore || scoreAiItem(item, query)),
      match: Math.min(99, Math.max(62, Math.round(Number(row?.match || item.match || 80)))),
      reason: cleanModelReason(row?.reason || item.reason, item, query),
      aiSource: provider
    })
    if(selected.length >= limit) break
  }

  if(selected.length < Math.min(limit, 8)){
    for(const item of candidatePool){
      if(!item?.slug || used.has(item.slug) || isSeedCatalogItem(item)) continue
      used.add(item.slug)
      selected.push({
        ...item,
        match: Math.min(96, Math.max(60, Math.round(item.match || 60 + Number(item.aiScore || 0) / 18))),
        reason: cleanModelReason(item.reason, item, query),
        aiSource: selected.length ? `${provider}+local` : 'local'
      })
      if(selected.length >= limit) break
    }
  }

  selected.sort((a,b) => {
    const exactDiff = titleMatchBoost(b, query) - titleMatchBoost(a, query)
    if(exactDiff) return exactDiff
    return Number(b.match || 0) - Number(a.match || 0)
  })

  return selected.slice(0, limit)
}

function getExternalEndpoint(){
  const raw = String(process.env.AI_RECOMMEND_ENDPOINT || process.env.EXTERNAL_AI_RECOMMEND_ENDPOINT || '').trim()
  if(!raw) return ''
  try{
    const url = new URL(raw)
    if(!['https:', 'http:'].includes(url.protocol)) return ''
    return url.toString()
  }catch{
    return ''
  }
}

async function recommendViaExternalBackend(payload, candidatePool, query, limit, model, provider){
  const endpoint = getExternalEndpoint()
  if(!endpoint){
    return { configured:false }
  }

  if(Date.now() < Number(EXTERNAL_AI_COOLDOWN.until || 0)){
    return {
      configured:true,
      ok:false,
      status: EXTERNAL_AI_COOLDOWN.status || 429,
      error: EXTERNAL_AI_COOLDOWN.reason || 'external_ai_cooldown'
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), EXTERNAL_AI_TIMEOUT_MS)
  const headers = { 'Content-Type': 'application/json' }
  const secret = String(process.env.AI_RECOMMEND_SECRET || process.env.EXTERNAL_AI_SECRET || '').trim()
  if(secret) headers['X-Aianime-AI-Secret'] = secret

  try{
    const res = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        ...payload,
        provider,
        model,
        limit,
        source_site: 'aianime.ru'
      })
    })
    clearTimeout(timeout)

    const text = await res.text().catch(() => '')
    const parsed = parseJsonPayload(text)

    if(!res.ok){
      if(res.status === 429){
        EXTERNAL_AI_COOLDOWN.until = Date.now() + EXTERNAL_AI_429_COOLDOWN_MS
        EXTERNAL_AI_COOLDOWN.status = 429
        EXTERNAL_AI_COOLDOWN.reason = 'Gemini quota/rate limit cooldown'
      }
      return {
        configured:true,
        ok:false,
        status:res.status,
        error:truncateText(text || res.statusText, 260)
      }
    }

    if(parsed?.source === 'external-local' && parsed?.meta?.status === 429){
      EXTERNAL_AI_COOLDOWN.until = Date.now() + EXTERNAL_AI_429_COOLDOWN_MS
      EXTERNAL_AI_COOLDOWN.status = 429
      EXTERNAL_AI_COOLDOWN.reason = 'Gemini quota/rate limit cooldown'
      return {
        configured:true,
        ok:false,
        status:429,
        error:'Gemini quota/rate limit cooldown'
      }
    }

    const results = mergeModelResults(parsed, candidatePool, query, limit, provider || 'external')
    return {
      configured:true,
      ok:true,
      source: parsed?.source || (provider === 'gemini' ? 'external-gemini' : 'external-openai'),
      model: parsed?.model || model,
      summary: truncateText(parsed?.summary || 'Внешний AI-backend подобрал тайтлы по смыслу запроса.', 220),
      results,
      meta: { ...(parsed?.openai || parsed?.meta || {}), candidateCount: candidatePool.length }
    }
  }catch(error){
    clearTimeout(timeout)
    return {
      configured:true,
      ok:false,
      error:truncateText(error?.message || error, 260)
    }
  }
}

async function recommendDirectGemini(payload, candidatePool, query, limit, localFallback, apiKey, model){
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)

  try{
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModelPath(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: `Ты живой аниме-куратор AIanime. Верни строго JSON. Выбирай только из candidates, slug не придумывай. Сначала пойми человеческий смысл запроса: персонаж, вайб, настроение, ограничение, похожий тайтл. Если есть точное название/персонаж из query_hints — ставь связанный тайтл первым. reason пиши по-русски как убедительное человеческое объяснение 14-28 слов. Запрещены шаблоны: 'жанры:', 'подходит по жанрам', 'короткий формат', 'удобный формат'.`
          }]
        },
        contents: [{
          role: 'user',
          parts: [{ text: JSON.stringify(payload) }]
        }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: Math.min(Math.max(Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || process.env.AI_MAX_OUTPUT_TOKENS || 520), 300), 700),
          responseMimeType: 'application/json'
        }
      })
    })

    clearTimeout(timeout)

    if(!res.ok){
      const errorText = await res.text().catch(() => '')
      return {
        source: 'local',
        model,
        summary: 'Быстрый подбор по каталогу готов. Gemini сейчас не ответил.',
        results: localFallback,
        openai: { enabled:true, provider:'gemini', ok:false, status:res.status, error:truncateText(errorText, 240) }
      }
    }

    const data = await res.json().catch(() => null)
    const parsed = parseJsonPayload(parseGeminiText(data))
    const results = mergeModelResults(parsed, candidatePool, query, limit, 'gemini')

    return {
      source: 'gemini',
      model: data?.modelVersion || model,
      summary: truncateText(parsed?.summary || 'Gemini подобрал тайтлы по смыслу запроса.', 220),
      results,
      openai: { enabled:true, provider:'gemini', ok:true, usage:data?.usageMetadata || null, candidateCount: candidatePool.length }
    }
  }catch(error){
    clearTimeout(timeout)
    return {
      source: 'local',
      model,
      summary: 'Быстрый подбор по каталогу готов. Gemini не ответил по таймауту/ошибке.',
      results: localFallback,
      openai: { enabled:true, provider:'gemini', ok:false, error:truncateText(error?.message || error, 220) }
    }
  }
}

async function recommendDirectOpenAI(payload, candidatePool, query, limit, localFallback, apiKey, model){
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)

  try{
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: Math.min(Math.max(Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || process.env.AI_MAX_OUTPUT_TOKENS || 650), 300), 900),
        input: [
          {
            role: 'developer',
            content: [{
              type: 'input_text',
              text: `Ты живой аниме-куратор AIanime. Отвечай строго JSON по схеме и выбирай только из candidates. Твоя цель — не фильтр, а умная подборка по человеческому смыслу запроса: вайб, настроение, персонаж, похожий тайтл, ограничение. reason должен быть убедительным, разным, 14-28 слов, без шаблонов 'жанры:', 'подходит по жанрам', 'короткий формат'.`
            }]
          },
          {
            role: 'user',
            content: [{ type:'input_text', text: JSON.stringify(payload) }]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'aianime_recommendations',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['summary', 'results'],
              properties: {
                summary: { type: 'string' },
                results: {
                  type: 'array',
                  minItems: 0,
                  maxItems: 12,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['slug', 'match', 'reason'],
                    properties: {
                      slug: { type: 'string' },
                      match: { type: 'number' },
                      reason: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      })
    })

    clearTimeout(timeout)

    if(!res.ok){
      const errorText = await res.text().catch(() => '')
      return {
        source: 'local',
        model,
        summary: 'Быстрый подбор по каталогу готов. OpenAI API сейчас не ответил.',
        results: localFallback,
        openai: { enabled:true, ok:false, status:res.status, error:truncateText(errorText, 240) }
      }
    }

    const data = await res.json().catch(() => null)
    const parsed = parseJsonPayload(parseOpenAiText(data))
    const results = mergeModelResults(parsed, candidatePool, query, limit, 'openai')

    return {
      source: 'openai',
      model: data?.model || model,
      summary: truncateText(parsed?.summary || 'OpenAI подобрал тайтлы по смыслу запроса.', 180),
      results,
      openai: { enabled:true, ok:true, usage:data?.usage || null, candidateCount: candidatePool.length }
    }
  }catch(error){
    clearTimeout(timeout)
    return {
      source: 'local',
      model,
      summary: 'Быстрый подбор по каталогу готов. OpenAI API не ответил по таймауту/ошибке.',
      results: localFallback,
      openai: { enabled:true, ok:false, error:truncateText(error?.message || error, 220) }
    }
  }
}

export async function recommendWithOpenAI(list, query = '', options = {}){
  const limit = Math.min(Math.max(Number(options.limit || 12), 1), 24)
  const candidatePool = buildCandidatePool(list, query, options)
  const localFallback = makeFallbackResults(candidatePool, query, limit)
  const provider = getConfiguredProvider()
  const model = getProviderModel(provider)
  const requestContext = getRequestContext(options)
  const candidates = candidatePool.map((item, index) => compactCandidate(item, query, index))
  const payload = {
    user_query: String(query || '').trim(),
    query_hints: [
      ...getQueryEntityHints(query),
      ...getQueryTopicHints(query)
    ].map(hint => ({ id: hint.id, note: truncateText(hint.note, 90), targets: (hint.titleTargets || []).slice(0, 5), genres: (hint.genres || []).slice(0, 4) })),
    rules: [
      'Только candidates, slug не придумывай.',
      'До 8 результатов. Точное название/персонаж из query_hints ставь первым.',
      'reason: живая причина 14-28 слов, без шаблонов про жанры/формат.'
    ],
    candidates
  }

  if(provider === 'local'){
    return localPayload('AI-провайдер отключён, используется быстрый локальный подбор.', localFallback, { reason:'provider_local' })
  }

  const external = await recommendViaExternalBackend(payload, candidatePool, query, limit, model, provider)
  if(external.configured && external.ok){
    return {
      source: external.source || (provider === 'gemini' ? 'external-gemini' : 'external-openai'),
      model: external.model || model,
      summary: external.summary,
      results: external.results,
      openai: { enabled:true, provider, ok:true, via:'external', endpointConfigured:true, candidateCount: candidatePool.length, meta:external.meta || null }
    }
  }

  if(provider === 'gemini'){
    const geminiKey = getGeminiApiKey()
    if(!geminiKey){
      return localPayload(
        external.configured
          ? 'Быстрый подбор по каталогу готов. Внешний AI-backend не ответил.'
          : 'Gemini API key не задан, поэтому используется локальный подбор.',
        localFallback,
        { provider:'gemini', reason:'missing_gemini_api_key', external: external.configured ? { ok:false, status:external.status || null, error:external.error || null } : null }
      )
    }
    const direct = await recommendDirectGemini(payload, candidatePool, query, limit, localFallback, geminiKey, model)
    if(external.configured && direct?.openai){
      direct.openai.external = { ok:false, status:external.status || null, error:external.error || null }
    }
    return direct
  }

  const openAiKey = String(process.env.OPENAI_API_KEY || '').trim()
  if(!openAiKey){
    return localPayload(
      external.configured
        ? 'Быстрый подбор по каталогу готов. Внешний AI-backend не ответил.'
        : 'OpenAI API key не задан, поэтому используется локальный подбор.',
      localFallback,
      { provider:'openai', reason:'missing_openai_api_key', external: external.configured ? { ok:false, status:external.status || null, error:external.error || null } : null }
    )
  }

  const direct = await recommendDirectOpenAI(payload, candidatePool, query, limit, localFallback, openAiKey, model)
  if(external.configured && direct?.openai){
    direct.openai.external = { ok:false, status:external.status || null, error:external.error || null }
  }
  return direct
}
