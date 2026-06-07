import { recommendAnime } from '@/lib/aiAnime'
import { scoreAiItem, explainAiMatch, getQueryIntent } from '@/lib/searchRelevance'

const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini'
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite'
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_RECOMMEND_TIMEOUT_MS || process.env.AI_RECOMMEND_TIMEOUT_MS || 8000)
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_RECOMMEND_TIMEOUT_MS || process.env.AI_RECOMMEND_TIMEOUT_MS || 8000)
const OPENAI_CANDIDATE_LIMIT = Number(process.env.OPENAI_RECOMMEND_CANDIDATES || process.env.AI_RECOMMEND_CANDIDATES || 120)
const EXTERNAL_AI_TIMEOUT_MS = Number(process.env.AI_RECOMMEND_TIMEOUT_MS || process.env.EXTERNAL_AI_TIMEOUT_MS || 8000)

function truncateText(value = '', limit = 240){
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if(text.length <= limit) return text
  return `${text.slice(0, limit - 1).trim()}…`
}

function cleanTitle(item){
  return String(item?.titleRu || item?.displayTitle || item?.title || item?.originalTitle || 'Без названия').trim()
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
  const genres = Array.isArray(item?.genres) ? item.genres.filter(Boolean).slice(0, 8) : []
  return {
    n: index + 1,
    slug: String(item?.slug || ''),
    title: cleanTitle(item),
    originalTitle: String(item?.originalTitle || item?.englishTitle || '').trim() || null,
    year: item?.year || null,
    episodes: Number(item?.episodes || 0) || null,
    status: item?.status || null,
    kind: item?.kind || null,
    genres,
    studio: item?.studio && item.studio !== '—' ? String(item.studio) : null,
    rating: Number(item?.sourceScore || item?.score || 0) || null,
    localScore: Math.round(Number(item?.aiScore || scoreAiItem(item, query) || 0)),
    localReason: truncateText(item?.reason || explainAiMatch(item, query), 180),
    description: truncateText(item?.descriptionRu || item?.description || '', 240)
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
    reason: item.reason || explainAiMatch(item, query)
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

function candidatePoolScore(item, query, intent){
  const genres = getCandidateGenres(item)
  let score = Number(scoreAiItem(item, query) || 0)

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

function decorateCandidate(item, query, intent){
  const score = candidatePoolScore(item, query, intent)
  return {
    ...item,
    aiScore: score,
    reason: item?.reason || explainAiMatch(item, query)
  }
}

function buildCandidatePool(list, query, options = {}){
  const safeList = Array.isArray(list) ? list.filter(item => item?.slug && !isSeedCatalogItem(item)) : []
  const baseSlug = options.baseSlug || null
  const requestedLimit = Number(options.limit || 12)
  // Для настоящего AI нельзя кормить модель одной карточкой. Даём ей широкую витрину,
  // а не жёсткий локальный фильтр. Иначе GPT честно выбирает 1 тайтл из 1 кандидата.
  const limit = Math.min(
    Math.max(OPENAI_CANDIDATE_LIMIT, requestedLimit * 18, 160),
    280
  )
  const intent = getQueryIntent(query)
  const related = relatedGenresForCandidatePool(intent.wantedGenres)
  const bySlug = new Map()

  function prepared(items = [], reasonBoost = 0){
    return items
      .filter(item => item?.slug && item.slug !== baseSlug)
      .map(item => {
        const decorated = decorateCandidate(item, query, intent)
        return {
          ...decorated,
          aiScore: Number(decorated.aiScore || 0) + reasonBoost
        }
      })
      .sort((a,b) => Number(b.aiScore || 0) - Number(a.aiScore || 0))
  }

  function add(items = [], maxAdd = limit){
    for(const item of items){
      if(!item?.slug || item.slug === baseSlug || bySlug.has(item.slug)) continue
      bySlug.set(item.slug, item)
      if(bySlug.size >= maxAdd || bySlug.size >= limit) break
    }
  }

  // 1) Самые точные совпадения по нескольким жанрам: например Романтика + Школа.
  if(intent.wantedGenres.length > 1){
    add(prepared(
      safeList.filter(item => {
        const genres = getCandidateGenres(item)
        return intent.wantedGenres.every(genre => genres.includes(genre))
      }),
      420
    ), Math.min(limit, 36))
  }

  // 2) Любой точный жанр из запроса. Не режем до одного результата.
  if(intent.wantedGenres.length){
    add(prepared(
      safeList.filter(item => hasAnyGenre(item, intent.wantedGenres)),
      300
    ), Math.min(limit, 80))
  }

  // 3) Соседние жанры по вайбу: романтика -> комедия/школа/повседневность/драма.
  if(related.length){
    add(prepared(
      safeList.filter(item => hasAnyGenre(item, related)),
      140
    ), Math.min(limit, 130))
  }

  // 4) Лёгкий запрос: дополнительно даём модели безопасные лёгкие варианты.
  if(intent.light || intent.noHeavy){
    add(prepared(
      safeList.filter(item => hasAnyGenre(item, ['Комедия', 'Романтика', 'Школа', 'Повседневность', 'Музыка'])),
      90
    ), Math.min(limit, 160))
  }

  // 5) Короткий формат: фильмы и тайтлы до 13 серий.
  if(intent.short){
    add(prepared(
      safeList.filter(item => item?.kind === 'movie' || (Number(item?.episodes || 0) > 0 && Number(item?.episodes || 0) <= 13)),
      70
    ), Math.min(limit, 180))
  }

  // 6) Старый локальный подбор оставляем как сигнал, но не позволяем ему сжать выборку до одного тайтла.
  add(prepared(recommendAnime(safeList, query, { ...options, limit: Math.min(limit, 120) }), 60), Math.min(limit, 190))

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
  if(filtered.length >= Math.min(24, requestedLimit * 3)) rows = filtered

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
      reason: truncateText(row?.reason || item.reason || explainAiMatch(item, query), 220),
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
        reason: item.reason || explainAiMatch(item, query),
        aiSource: selected.length ? `${provider}+local` : 'local'
      })
      if(selected.length >= limit) break
    }
  }

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
      return {
        configured:true,
        ok:false,
        status:res.status,
        error:truncateText(text || res.statusText, 260)
      }
    }

    const results = mergeModelResults(parsed, candidatePool, query, limit, provider || 'external')
    return {
      configured:true,
      ok:true,
      source: parsed?.source || (provider === 'gemini' ? 'external-gemini' : 'external-openai'),
      model: parsed?.model || model,
      summary: truncateText(parsed?.summary || 'Внешний AI-backend подобрал тайтлы по смыслу запроса.', 180),
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
            text: 'Ты умный рекомендатель аниме для AIanime. Верни строго JSON. Выбирай только из candidates. Нужно 8-12 тайтлов, если кандидатов достаточно. Разбирай естественные и кривые русские фразы пользователя: вайб, жанры, отрицания, похожесть на другой тайтл, характер героя, сеттинг. Не придумывай slug. reason пиши коротко по-русски.'
          }]
        },
        contents: [{
          role: 'user',
          parts: [{ text: JSON.stringify(payload) }]
        }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 1400,
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
      summary: truncateText(parsed?.summary || 'Gemini подобрал тайтлы по смыслу запроса.', 180),
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
        max_output_tokens: 1600,
        input: [
          {
            role: 'developer',
            content: [{
              type: 'input_text',
              text: 'Ты умный рекомендатель аниме для AIanime. Отвечай строго JSON по схеме. Работай только с переданным каталогом candidates. Твоя цель — не фильтр, а умная подборка по смыслу, жанрам, ограничениям и вайбу пользователя.'
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
    rules: [
      'Выбери только из candidates. Не придумывай slug и названия.',
      'Нужно вернуть 8-12 рекомендаций, если в candidates достаточно вариантов.',
      'Учитывай смысл запроса, отрицания и вайб, а не только отдельные слова.',
      'Разбирай даже кривые человеческие фразы: характер героя, профессия, пол героя, сеттинг, настроение, похожесть на другой тайтл.',
      'Если пользователь просит романтику — не ставь чистый экшен/триллер без романтики выше романтики, школы, комедии и повседневности.',
      'Если точных совпадений мало — добери близкие по вайбу, но объясни почему.',
      'Не повторяй почти одинаковые сезоны одной франшизы подряд.',
      'reason пиши коротко по-русски: почему именно этот тайтл подходит.'
    ],
    user_library: requestContext,
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
