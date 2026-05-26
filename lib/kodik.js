const BASE = 'https://kodik-api.com'

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getKodikToken(){
  return process.env.KODIK_TOKEN || process.env.NEXT_PUBLIC_KODIK_TOKEN || ''
}

export function hasKodik(){
  return Boolean(getKodikToken())
}

function clean(value){
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text || null
}

function asNumber(value){
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeTitle(value){
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/&/g, ' and ')
    .replace(/\bseason\b/g, ' season ')
    .replace(/\bpart\b/g, ' part ')
    .replace(/\btv\b/g, ' tv ')
    .replace(/[\[\]{}()]/g, ' ')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleTokens(value){
  return normalizeTitle(value).split(' ').filter(token => token.length > 2)
}

function externalIdFromAnime(anime = {}){
  const values = [
    anime.shikimori_id,
    anime.shikimoriId,
    anime.mal_id,
    anime.malId,
  ]
  const slugMatch = String(anime.slug || '').match(/^(\d+)-/)
  if(slugMatch) values.push(slugMatch[1])

  for(const value of values){
    const id = Number(value)
    if(Number.isFinite(id) && id > 0) return Math.floor(id)
  }
  return null
}


function isAnimeMovie(anime = {}){
  const kind = String(anime?.kind || anime?.type || anime?.kodikType || '').toLowerCase()
  const titleText = normalizeTitle([anime?.slug, anime?.title, anime?.title_ru, anime?.original_title].filter(Boolean).join(' '))
  const episodes = Number(anime?.episodes || anime?.episodes_count || 0)
  if(kind === 'movie' || kind === 'film' || kind === 'anime-movie') return true
  if(/\b(movie|film|фильм|кино)\b/.test(titleText)) return true
  // MAL/Jikan movie pages обычно имеют 0 или 1 episode. Не считаем любой title с "season" фильмом.
  return episodes === 1 && /\bmovie\b|\bfilm\b|фильм/.test(titleText)
}

function materialTypeOf(material = {}){
  return String(material?.type || material?.material_type || material?.material_data?.type || '').toLowerCase()
}

function materialUrlOf(material = {}){
  return String(material?.link || material?.material_link || material?.iframe_url || '').toLowerCase()
}

function isKodikSerialMaterial(material = {}){
  const type = materialTypeOf(material)
  const url = materialUrlOf(material)
  return type.includes('serial') || /\/(serial|seria)\//i.test(url)
}

function isKodikMovieMaterial(material = {}){
  const type = materialTypeOf(material)
  const url = materialUrlOf(material)
  return type === 'anime' || type === 'movie' || /\/(video|movie)\//i.test(url)
}

function seasonMarkers(value){
  const text = normalizeTitle(value)
  const markers = []
  const season = text.match(/(?:season|сезон|тв|s)\s*(\d+)/i)
  const part = text.match(/(?:part|часть|cour|p)\s*(\d+)/i)
  const standalone = text.match(/(?:^|\s)(\d+)(?:\s|$)/)
  if(season) markers.push(`s${season[1]}`)
  if(part) markers.push(`p${part[1]}`)
  if(standalone) markers.push(`n${standalone[1]}`)
  if(/\bzero\b|\b0\b/.test(text)) markers.push('zero')
  if(/final|финал/.test(text)) markers.push('final')
  return markers
}

function markerPenalty(materialTitles, animeTitles){
  const animeText = normalizeTitle(animeTitles.join(' '))
  const materialText = normalizeTitle(materialTitles.join(' '))
  let penalty = 0

  // Частый плохой матч: Steins;Gate -> Steins;Gate 0.
  if(!/\b0\b|zero|ноль/.test(animeText) && (/\b0\b|zero|ноль/.test(materialText))) penalty -= 30

  const animeMarkers = new Set(seasonMarkers(animeText))
  const materialMarkers = new Set(seasonMarkers(materialText))
  for(const marker of materialMarkers){
    if((marker.startsWith('s') || marker.startsWith('p') || marker === 'zero') && animeMarkers.size && !animeMarkers.has(marker)) penalty -= 12
  }
  return penalty
}

function similarityScore(a, b){
  const left = new Set(titleTokens(a))
  const right = new Set(titleTokens(b))
  if(!left.size || !right.size) return 0
  let inter = 0
  for(const token of left) if(right.has(token)) inter += 1
  return inter / Math.max(left.size, right.size)
}

function normalizeScreenshots(value){
  if(!Array.isArray(value)) return []
  return value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 8)
}

function bestTranslation(material){
  const tr = material?.translation || null
  if(!tr || typeof tr !== 'object') return { title:null, type:null, id:null }
  return {
    title: clean(tr.title),
    type: clean(tr.type),
    id: asNumber(tr.id)
  }
}

function requestParams(params = {}){
  const token = getKodikToken()
  if(!token) throw new Error('KODIK_TOKEN is not configured')

  const search = new URLSearchParams()
  search.set('token', token)
  search.set('limit', String(Math.min(Math.max(Number(params.limit) || 1, 1), 100)))
  search.set('with_material_data', params.withMaterialData === false ? 'false' : 'true')

  // Берём только anime-сущности. Kodik различает anime/anime-serial.
  search.set('types', params.types || 'anime,anime-serial')

  if(params.title) search.set('title', String(params.title))
  if(params.shikimoriId) search.set('shikimori_id', String(params.shikimoriId))
  if(params.year) search.set('year', String(params.year))
  if(params.translationId) search.set('translation_id', String(params.translationId))
  if(params.withSeasons) search.set('with_seasons', 'true')
  if(params.withEpisodes) search.set('with_episodes', 'true')
  if(params.withEpisodesData) search.set('with_episodes_data', 'true')
  if(params.withPageLinks) search.set('with_page_links', 'true')
  if(params.episode) search.set('episode', String(params.episode))
  if(params.season) search.set('season', String(params.season))

  return search
}

async function fetchJsonWithTimeout(url, { timeout = 10000, retries = 1 } = {}){
  let lastError = null

  for(let attempt = 0; attempt <= retries; attempt++){
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try{
      const res = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Aianime/1.0 Kodik metadata sync'
        }
      })

      if((res.status === 429 || res.status >= 500) && attempt < retries){
        await sleep(1200 + attempt * 900)
        continue
      }

      if(!res.ok){
        const text = await res.text().catch(() => '')
        throw new Error(`Kodik ${res.status}: ${text.slice(0, 180)}`)
      }

      return await res.json()
    }catch(error){
      lastError = error
      if(attempt < retries) await sleep(800 + attempt * 700)
    }finally{
      clearTimeout(timer)
    }
  }

  throw lastError || new Error('Kodik request failed')
}

function scoreMatch(material, anime){
  const materialTitles = [material?.title, material?.title_orig, material?.other_title]
    .map(clean)
    .filter(Boolean)
  const animeTitles = [anime?.original_title, anime?.title_ru, anime?.title]
    .map(clean)
    .filter(Boolean)

  let score = 0
  for(const animeTitle of animeTitles){
    const animeNorm = normalizeTitle(animeTitle)
    if(!animeNorm) continue

    for(const materialTitle of materialTitles){
      const materialNorm = normalizeTitle(materialTitle)
      if(!materialNorm) continue
      if(materialNorm === animeNorm) score += 80
      else if(materialNorm.includes(animeNorm) || animeNorm.includes(materialNorm)) score += 34
      score += Math.round(similarityScore(materialTitle, animeTitle) * 28)
    }
  }

  const year = Number(anime?.year || 0)
  const materialYear = Number(material?.year || material?.material_data?.year || 0)
  if(year && materialYear){
    const diff = Math.abs(year - materialYear)
    if(diff === 0) score += 28
    else if(diff === 1) score += 8
    else if(diff <= 3) score -= 16
    else score -= 36
  }

  score += markerPenalty(materialTitles, animeTitles)

  if(material?.type && String(material.type).includes('anime')) score += 8
  if(material?.translation?.type === 'voice') score += 4

  // Важный guard: фильм не должен матчиться на сериал Kodik.
  // Например Chainsaw Man Movie: Reze-hen не должен получать TV-сериал Chainsaw Man.
  if(isAnimeMovie(anime)){
    if(isKodikSerialMaterial(material)) score -= 1000
    if(isKodikMovieMaterial(material)) score += 70
  }else{
    const expectedEpisodes = Number(anime?.episodes || 0)
    if(expectedEpisodes > 1 && isKodikSerialMaterial(material)) score += 30
    if(expectedEpisodes > 1 && isKodikMovieMaterial(material) && !isKodikSerialMaterial(material)) score -= 120
  }

  // Глобальный guard против неверных сезонов/OVA: если страница на 2 серии или Season 2,
  // не принимаем TV-сериал на 25+ серий только из-за совпадения франшизы.
  if(shouldRejectMaterialForAnime(material, anime)) score -= 1000

  if(material?.blocked_countries?.length) score -= 5
  if(material?.camrip) score -= 10

  return score
}

function chooseBestResult(results, anime, { minScore = 24 } = {}){
  const list = Array.isArray(results) ? results : []
  if(!list.length) return null
  const ranked = list
    .map(item => ({ item, score: scoreMatch(item, anime) }))
    .sort((a,b) => b.score - a.score)
  const best = ranked[0]
  if(!best || best.score < minScore) return null
  best.item.__aianime_match_score = best.score
  return best.item
}

export async function searchKodikMaterial({ anime = {}, title = '', shikimoriId = null, limit = 5 } = {}){
  const queryTitle = clean(title || anime.title_ru || anime.original_title || anime.title)
  const year = asNumber(anime.year)
  const attempts = []

  if(queryTitle && year) attempts.push({ title: queryTitle, year })
  if(queryTitle) attempts.push({ title: queryTitle })

  // shikimoriId используем только если он явно похож на Shikimori id, а не на MAL id из legacy-схемы.
  // В текущей базе поле shikimori_id часто хранит MAL id, поэтому не делаем его главным ключом.
  if(shikimoriId && !queryTitle) attempts.push({ shikimoriId })

  let lastPayload = null
  for(const attempt of attempts){
    const params = requestParams({ ...attempt, limit, withMaterialData: true })
    const payload = await fetchJsonWithTimeout(`${BASE}/search?${params.toString()}`, { timeout: 11000, retries: 1 })
    lastPayload = payload
    const results = Array.isArray(payload?.results) ? payload.results : []
    const best = chooseBestResult(results, anime)
    if(best) return best
  }

  const results = Array.isArray(lastPayload?.results) ? lastPayload.results : []
  return chooseBestResult(results, anime, { minScore: 34 })
}


export async function searchKodikMaterialsForAnime(anime, {
  limit = 30,
  withEpisodes = true,
  withEpisodesData = false,
  minScore = 22
} = {}){
  const candidates = [
    anime?.original_title,
    anime?.title_ru,
    anime?.title,
  ].map(clean).filter(Boolean)

  const seen = new Map()
  let lastError = null

  const collectResults = (results, { reliableId = false } = {}) => {
    for(const item of Array.isArray(results) ? results : []){
      if(item?.type && !String(item.type).includes('anime')) continue
      // Для страниц-фильмов, OVA и конкретных сезонов не сохраняем чужой сериал/сезон.
      if(shouldRejectMaterialForAnime(item, anime)) continue
      const score = scoreMatch(item, anime)
      // Поиск по shikimori_id/MAL-id гораздо точнее названия: Kodik сам возвращает варианты озвучек.
      // Поэтому не режем такие результаты слишком агрессивно по title-score.
      if(!reliableId && score < minScore) continue
      const translation = bestTranslation(item)
      const key = `${item?.id || item?.link || ''}:${translation.id || translation.title || ''}`
      if(!key.trim()) continue
      const existing = seen.get(key)
      const stableScore = reliableId ? score + 1000 : score
      if(!existing || stableScore > existing.__aianime_stable_score){
        item.__aianime_match_score = score
        item.__aianime_stable_score = stableScore
        item.__aianime_reliable_id = reliableId
        seen.set(key, item)
      }
    }
  }

  const externalId = externalIdFromAnime(anime)
  if(externalId){
    try{
      const params = requestParams({
        shikimoriId: externalId,
        limit,
        withMaterialData: true,
        withEpisodes,
        withEpisodesData,
      })
      const payload = await fetchJsonWithTimeout(`${BASE}/search?${params.toString()}`, { timeout: 14000, retries: 1 })
      collectResults(payload?.results, { reliableId:true })
    }catch(error){
      lastError = error
    }
  }

  // Если id-поиск ничего не дал — пробуем по названиям. Это менее точно, поэтому ниже порог по score.
  for(const title of [...new Set(candidates)]){
    try{
      const params = requestParams({
        title,
        limit,
        withMaterialData: true,
        withEpisodes,
        withEpisodesData,
      })
      const payload = await fetchJsonWithTimeout(`${BASE}/search?${params.toString()}`, { timeout: 13000, retries: 1 })
      collectResults(payload?.results, { reliableId:false })
    }catch(error){
      lastError = error
    }
  }

  const rows = Array.from(seen.values()).sort((a,b) => Number(b.__aianime_stable_score || b.__aianime_match_score || 0) - Number(a.__aianime_stable_score || a.__aianime_match_score || 0))
  if(rows.length) return rows
  if(lastError) throw lastError
  return []
}

function getEpisodeCountFromMaterial(material, fallback = 1){
  const values = [
    material?.episodes_count,
    material?.last_episode,
    material?.material_data?.episodes_count,
    material?.material_data?.episodes_total,
    material?.material_data?.episodes_aired,
    material?.material_data?.episodes,
    fallback
  ]
  for(const value of values){
    const number = Number(value)
    if(Number.isFinite(number) && number > 0) return Math.min(Math.max(Math.floor(number), 1), 1200)
  }
  return 1
}

function animeEpisodeText(anime = {}){
  return normalizeTitle([
    anime?.kind, anime?.type, anime?.kodikType,
    anime?.slug, anime?.title, anime?.title_ru, anime?.titleRu,
    anime?.original_title, anime?.originalTitle, anime?.englishTitle,
    anime?.description, anime?.description_ru, anime?.descriptionRu
  ].filter(Boolean).join(' '))
}

function extractEpisodeCountFromText(text){
  const normalized = normalizeTitle(text)
  const patterns = [
    /(?:в сезоне указано|указано|сезоне|сезон)\s*(\d{1,3})\s*(?:сер|серии|серий|эп|эпизод)/i,
    /(\d{1,3})\s*(?:серия|серии|серий|эпизод|эпизода|эпизодов|ova|она)/i,
    /(?:ova|она|special|спешл)\s*(\d{1,3})/i,
  ]
  for(const pattern of patterns){
    const match = normalized.match(pattern)
    const n = Number(match?.[1])
    if(Number.isFinite(n) && n > 0 && n < 500) return Math.floor(n)
  }
  const ovaDash = normalized.match(/(?:ova|она)\s*(\d{1,2})(?:\s|$)/i)
  const ovaNumber = Number(ovaDash?.[1])
  if(Number.isFinite(ovaNumber) && ovaNumber > 0 && ovaNumber <= 12) return Math.floor(ovaNumber)
  return 0
}

function expectedEpisodesFromAnime(anime = {}){
  const values = [anime?.episodes, anime?.episodes_count, anime?.episodesTotal, anime?.episodesList?.length]
  for(const value of values){
    const n = Number(value)
    if(Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  return extractEpisodeCountFromText(animeEpisodeText(anime))
}

function animeKindText(anime = {}){
  return animeEpisodeText(anime)
}

function hasSeasonMarkerText(text){
  const value = String(text || '')
  return /(?:season|сезон|tv|тв|сезон|тв)[\s._:-]*\d|(?:part|часть|cour)[\s._:-]*\d|\b\d+(?:st|nd|rd|th)[\s._:-]+season\b|\bs\d+\b|\bp\d+\b|\bthe[\s._:-]*final\b|\bfinal\s*season\b|финал|финальный|заключительный/.test(value)
}

function hasSpecialMarkerText(text){
  return /\bova\b|\bona\b|special|спешл|спец|kuinaki|sentaku|regrets|reze|movie|film|фильм|lost\s+girls|no\s+regrets|выбор\s+без\s+сожалений/.test(String(text || ''))
}

function extractStrongSeasonMarkers(text){
  const normalized = normalizeTitle(text)
  const markers = new Set()

  const seasonPatterns = [
    /(?:season|сезон|tv|тв|s)[\s._:-]*(\d+)/i,
    /(\d+)\s*(?:st|nd|rd|th)?\s*(?:season|сезон)/i,
    /(?:shingeki|attack\s+on\s+titan).*?(\d+)\s*(?:st|nd|rd|th)?\s*(?:season|сезон)/i,
  ]
  const partPatterns = [
    /(?:part|часть|cour|p)[\s._:-]*(\d+)/i,
    /(\d+)\s*(?:st|nd|rd|th)?\s*(?:part|часть|cour)/i,
  ]

  for(const pattern of seasonPatterns){
    const match = normalized.match(pattern)
    if(match){
      markers.add(`s${match[1]}`)
      break
    }
  }

  for(const pattern of partPatterns){
    const match = normalized.match(pattern)
    if(match){
      markers.add(`p${match[1]}`)
      break
    }
  }

  if(/\bova\b|\bona\b|special|спешл|спец/.test(normalized)) markers.add('special')
  if(/kuinaki|sentaku|regrets|lost\s+girls|no\s+regrets|выбор\s+без\s+сожалений/.test(normalized)) markers.add('special')
  if(/movie|film|фильм|reze/.test(normalized)) markers.add('movie')
  if(/\bthe[\s._:-]*final\b|\bfinal\s*season\b|финал|финальный|заключительный/.test(normalized)) markers.add('final')
  return markers
}

function markersCompatible(material, anime = {}){
  const animeMarkers = extractStrongSeasonMarkers(animeKindText(anime))
  if(!animeMarkers.size) return true
  const materialTitles = materialTitlesForGuard(material)
  const materialMarkers = extractStrongSeasonMarkers(materialTitles.join(' '))
  const expected = expectedEpisodesFromAnime(anime)
  const actual = getEpisodeCountFromMaterial(material, 0)
  const titleSimilarity = maxTitleSimilarity(materialTitles, animeTitlesForGuard(anime))

  // Если страница явно Season N / Part N, Kodik-результат должен содержать тот же маркер.
  // Иначе франшизы вроде Attack on Titan будут подтягивать соседний сезон.
  for(const marker of animeMarkers){
    if((marker.startsWith('s') || marker.startsWith('p')) && !materialMarkers.has(marker)){
      // Исключение только для почти точного названия и совпадающего количества серий.
      if(!(titleSimilarity >= 0.92 && expected && actual && actual <= expected)) return false
    }
  }

  // OVA/спешлы не должны матчиться на обычный TV-сезон без OVA/special-маркера.
  if(animeMarkers.has('special') && !materialMarkers.has('special')){
    // Некоторые Kodik-записи для OVA не имеют слова OVA, но имеют точное название и 1–2 серии.
    if(!(titleSimilarity >= 0.88 && expected && actual && actual <= expected)) return false
  }

  return true
}

function strictEpisodeTolerance(anime = {}){
  const text = animeKindText(anime)
  if(hasSpecialMarkerText(text)) return 1
  if(hasSeasonMarkerText(text)) return 1
  return 6
}

function isLongFranchiseAnime(anime = {}){
  const expected = expectedEpisodesFromAnime(anime)
  const text = animeKindText(anime)
  return Boolean(
    expected > 64
    || /pokemon|покемон|pocket monster|naruto|one piece|bleach|conan|detective conan|dragon ball|yu-gi-oh|yugioh|digimon|precure/.test(text)
  )
}

function weakLongFranchiseMaterial(material, anime = {}){
  if(!isLongFranchiseAnime(anime)) return false
  const expected = expectedEpisodesFromAnime(anime)
  const actual = getEpisodeCountFromMaterial(material, 0)
  const reliable = Boolean(material?.__aianime_reliable_id)

  const score = Number(material?.__aianime_match_score || 0) || 0
  const season = Number(material?.season_number || material?.material_data?.season_number || 0) || 0
  const exactShortMatch = expected >= 2 && expected <= 64
    && actual === expected
    && score >= 250
    && (!season || season <= 3)

  // Для Pokémon/Naruto/One Piece/etc совпадение по названию слишком опасно:
  // соседний сезон/арка часто имеет тот же franchise title. Без reliable id не сохраняем,
  // кроме коротких точных релизов внутри франшизы вроде Pokémon 2023 на 11 серий.
  if(!reliable && !exactShortMatch) return true

  if(expected > 64 && actual && actual < Math.max(8, Math.floor(expected * 0.08))) return true
  return false
}

function materialTitlesForGuard(material = {}){
  return [
    material?.title,
    material?.title_orig,
    material?.other_title,
    material?.material_data?.title,
    material?.material_data?.title_orig,
    material?.material_data?.other_title,
  ].map(clean).filter(Boolean)
}

function animeTitlesForGuard(anime = {}){
  return [
    anime?.original_title,
    anime?.originalTitle,
    anime?.englishTitle,
    anime?.title_ru,
    anime?.title,
    anime?.slug,
  ].map(clean).filter(Boolean)
}

function maxTitleSimilarity(materialTitles, animeTitles){
  let best = 0
  for(const materialTitle of materialTitles){
    for(const animeTitle of animeTitles){
      best = Math.max(best, similarityScore(materialTitle, animeTitle))
    }
  }
  return best
}

function expectedEpisodeMismatch(material, anime = {}){
  const expected = expectedEpisodesFromAnime(anime)
  const actual = getEpisodeCountFromMaterial(material, 0)
  if(!expected || !actual) return false

  const text = animeKindText(anime)
  const materialType = materialTypeOf(material)
  const specialLike = hasSpecialMarkerText(text) || /ova|ona|special/.test(String(anime?.kind || anime?.type || '').toLowerCase())
  const seasonLike = hasSeasonMarkerText(text)

  // OVA/спешлы/короткие тайтлы должны быть жёсткими по количеству серий.
  // Если ожидается 2 серии, TV-сезон на 25/26 серий не проходит.
  if(expected <= 6 && actual > expected) return true
  if(specialLike && expected <= 12 && actual > expected) return true

  // Страницы конкретных сезонов/частей должны совпадать по верхней границе.
  // Например Season 3 Part 2 на 10 серий не должен принимать Season 3 на 25 серий.
  if(seasonLike && expected >= 7 && expected <= 64 && actual > expected) return true

  // Общая защита для завершённых/известных тайтлов: если в нашей базе 13 серий,
  // а Kodik-матч тянет 25/26, это почти всегда соседний сезон франшизы.
  if(expected >= 7 && expected <= 64 && actual > expected + strictEpisodeTolerance(anime)) return true

  // Если это сериал Kodik, но ожидается совсем короткий тайтл — это почти всегда неверный матч.
  if(expected <= 3 && (materialType.includes('serial') || isKodikSerialMaterial(material)) && actual >= 8) return true

  return false
}

function markerMismatch(material, anime = {}){
  const animeText = animeKindText(anime)
  const materialText = normalizeTitle(materialTitlesForGuard(material).join(' '))
  if(!materialText) return false

  // Если в нашем тайтле явно указан Season 2/Part 2/OVA/etc, а Kodik-результат — общий базовый сериал,
  // не принимаем его, даже если совпадает корневая франшиза.
  const animeHasStrongMarker = hasSeasonMarkerText(animeText) || hasSpecialMarkerText(animeText)
  if(!animeHasStrongMarker) return false

  const materialHasSeason = hasSeasonMarkerText(materialText)
  const materialHasSpecial = hasSpecialMarkerText(materialText)
  const sim = maxTitleSimilarity(materialTitlesForGuard(material), animeTitlesForGuard(anime))

  if(hasSeasonMarkerText(animeText) && !materialHasSeason && sim < 0.78) return true
  if(hasSpecialMarkerText(animeText) && !materialHasSpecial && expectedEpisodesFromAnime(anime) <= 12 && sim < 0.82) return true

  return false
}

function shouldRejectMaterialForAnime(material, anime = {}){
  if(!material) return true
  if(isAnimeMovie(anime) && isKodikSerialMaterial(material)) return true
  if(!markersCompatible(material, anime)) return true
  if(weakLongFranchiseMaterial(material, anime)) return true
  if(expectedEpisodeMismatch(material, anime)) return true
  if(markerMismatch(material, anime)) return true
  return false
}

function addEpisodeParamToKodikUrl(value, episodeNumber){
  const url = normalizeKodikPlayerUrl(value)
  const episode = Math.max(1, Number(episodeNumber) || 1)
  if(!url) return null
  try{
    const parsed = new URL(url)
    // Kodik serial/season iframe принимает номер эпизода как query-подсказку.
    // Если конкретная seria-ссылка известна, она останется приоритетнее;
    // этот URL нужен для голосов, где API отдаёт только season/serial link + episodes_count.
    parsed.searchParams.set('episode', String(episode))
    parsed.searchParams.set('seria', String(episode))
    return parsed.toString()
  }catch{
    return url
  }
}

function normalizeSeasonEntries(seasons){
  if(!seasons) return []
  const entries = Array.isArray(seasons)
    ? seasons.map((season, index) => [season?.season ?? season?.number ?? index + 1, season])
    : Object.entries(seasons)
  return entries
    .map(([seasonNumber, season]) => ({ seasonNumber:Number(seasonNumber) || 1, season:season || {} }))
    .sort((a,b) => a.seasonNumber - b.seasonNumber)
}

function normalizeEpisodeEntries(episodes){
  if(!episodes) return []
  const entries = Array.isArray(episodes)
    ? episodes.map((episode, index) => [episode?.episode ?? episode?.number ?? index + 1, episode])
    : Object.entries(episodes)
  return entries
    .map(([episodeNumber, episode]) => ({
      episodeNumber:Number(episodeNumber) || Number(episode?.episode || episode?.number || 1) || 1,
      episode:typeof episode === 'string' ? { link:episode } : (episode || {})
    }))
    .sort((a,b) => a.episodeNumber - b.episodeNumber)
}

function collectKodikSeasonSources(material){
  const sources = []
  const pushSeasons = (seasons) => {
    for(const item of normalizeSeasonEntries(seasons)) sources.push(item)
  }

  pushSeasons(material?.seasons)
  pushSeasons(material?.material_data?.seasons)

  if(material?.episodes) sources.push({ seasonNumber:1, season:{ episodes:material.episodes } })
  if(material?.material_data?.episodes && typeof material.material_data.episodes === 'object'){
    sources.push({ seasonNumber:1, season:{ episodes:material.material_data.episodes } })
  }

  const seen = new Set()
  return sources.filter(item => {
    const key = `${item.seasonNumber}:${JSON.stringify(item.season).slice(0, 120)}`
    if(seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function normalizeKodikEpisodeRows(anime, material, { maxEpisodes = 500 } = {}){
  if(!anime?.slug || !material) return []
  const translation = bestTranslation(material)
  const voice = clean(translation.title) || 'Kodik'
  const translationType = clean(translation.type) || 'voice'
  const provider = 'kodik'
  const quality = clean(material.quality)
  const rows = []
  const seasons = collectKodikSeasonSources(material)
  const declaredCount = getEpisodeCountFromMaterial(material, anime?.episodes || 1)
  const materialLink = normalizeKodikPlayerUrl(material.link)
  const bestSeasonLink = normalizeKodikPlayerUrl(
    seasons.find(item => normalizeKodikPlayerUrl(item?.season?.link))?.season?.link
  ) || materialLink

  for(const { seasonNumber, season } of seasons){
    const episodeEntries = normalizeEpisodeEntries(season?.episodes || season)
    for(const { episodeNumber, episode } of episodeEntries){
      const embedUrl = normalizeKodikPlayerUrl(episode?.link || episode?.embed_url || episode?.url || episode?.player_link || episode?.iframe_url)
      if(!embedUrl) continue
      rows.push({
        anime_slug: anime.slug,
        episode_number: episodeNumber,
        title: clean(episode?.title) || `Серия ${episodeNumber}`,
        provider,
        voice,
        embed_url: embedUrl,
        hls_url: null,
        status: 'published',
        source: 'kodik-api-episode',
        raw: {
          source: 'kodik-api-episode',
          kodik_id: clean(material.id),
          material_type: clean(material.type),
          material_link: materialLink,
          material_title: clean(material?.title),
          material_title_orig: clean(material?.title_orig),
          material_other_title: clean(material?.other_title),
          episodes_count: declaredCount,
          season_number: seasonNumber,
          season_link: normalizeKodikPlayerUrl(season?.link),
          episode_link: embedUrl,
          episode_title: clean(episode?.title),
          screenshots: Array.isArray(episode?.screenshots) ? episode.screenshots : [],
          translation_id: translation.id,
          translation_title: voice,
          translation_type: translationType,
          quality,
          match_score: asNumber(material.__aianime_match_score),
          reliable_id: Boolean(material.__aianime_reliable_id),
        },
        updated_at: new Date().toISOString()
      })
      if(rows.length >= maxEpisodes) return rows
    }
  }

  // Kodik часто отдаёт только часть seria-ссылок, но вместе с season/serial link и episodes_count.
  // Чтобы внешний список серий был полным, добиваем недостающие серии season/serial iframe-ссылкой
  // с query-подсказкой episode/seria. Если конкретная seria-ссылка была в API — она остаётся приоритетнее.
  const existingEpisodes = new Set(rows.map(row => Number(row.episode_number || 1)))
  const shouldHydrateFromSeason = bestSeasonLink && declaredCount > 1 && existingEpisodes.size < declaredCount
  if(shouldHydrateFromSeason){
    const limit = Math.min(declaredCount, Math.max(Number(maxEpisodes) || 500, 1))
    for(let episodeNumber = 1; episodeNumber <= limit; episodeNumber++){
      if(existingEpisodes.has(episodeNumber)) continue
      const embedUrl = addEpisodeParamToKodikUrl(bestSeasonLink, episodeNumber)
      if(!embedUrl) continue
      rows.push({
        anime_slug: anime.slug,
        episode_number: episodeNumber,
        title: `Серия ${episodeNumber}`,
        provider,
        voice,
        embed_url: embedUrl,
        hls_url: null,
        status: 'published',
        source: 'kodik-api-season-episode',
        raw: {
          source: 'kodik-api-season-episode',
          kodik_id: clean(material.id),
          material_type: clean(material.type),
          material_link: materialLink,
          material_title: clean(material?.title),
          material_title_orig: clean(material?.title_orig),
          material_other_title: clean(material?.other_title),
          season_link: bestSeasonLink,
          episode_link: embedUrl,
          episodes_count: declaredCount,
          synthetic_from_season: true,
          translation_id: translation.id,
          translation_title: voice,
          translation_type: translationType,
          quality,
          match_score: asNumber(material.__aianime_match_score),
          reliable_id: Boolean(material.__aianime_reliable_id),
        },
        updated_at: new Date().toISOString()
      })
      if(rows.length >= maxEpisodes) return rows
    }
  }

  // Если Kodik вообще не отдал seasons/episodes, сохраняем одну базовую ссылку.
  // Фейковый список серий без episodes_count не создаём.
  const baseUrl = materialLink
  if(baseUrl && !rows.length){
    rows.push({
      anime_slug: anime.slug,
      episode_number: 1,
      title: 'Серия 1',
      provider,
      voice,
      embed_url: baseUrl,
      hls_url: null,
      status: 'published',
      source: 'kodik-api-player',
      raw: {
        source: 'kodik-api-player',
        kodik_id: clean(material.id),
        material_link: baseUrl,
        material_title: clean(material?.title),
        material_title_orig: clean(material?.title_orig),
        material_other_title: clean(material?.other_title),
        episodes_count: declaredCount,
        material_type: clean(material.type),
        reliable_id: Boolean(material.__aianime_reliable_id),
        translation_id: translation.id,
        translation_title: voice,
        translation_type: translationType,
        quality,
        match_score: asNumber(material.__aianime_match_score),
      },
      updated_at: new Date().toISOString()
    })
  }

  return rows.sort((a,b) => Number(a.episode_number || 0) - Number(b.episode_number || 0))
}

export async function resolveKodikEpisodeRowsForAnime(anime, options = {}){
  const materials = await searchKodikMaterialsForAnime(anime, options)
  const rows = []
  const seen = new Set()
  for(const material of materials){
    for(const row of normalizeKodikEpisodeRows(anime, material, options)){
      const key = `${row.anime_slug}:${row.episode_number}:${row.provider}:${row.voice}`
      if(seen.has(key)) continue
      seen.add(key)
      rows.push(row)
    }
  }
  return rows
}

export async function enrichAnimeWithKodik(anime, { limit = 5 } = {}){
  const candidates = [
    anime?.original_title,
    anime?.title_ru,
    anime?.title,
  ].map(clean).filter(Boolean)

  let lastError = null

  for(const title of [...new Set(candidates)]){
    try{
      const material = await searchKodikMaterial({ anime, title, limit })
      if(material) return normalizeKodikMaterial(material, anime)
    }catch(error){
      lastError = error
    }
  }

  if(lastError) throw lastError
  return null
}

export function normalizeKodikPlayerUrl(value){
  const raw = clean(value)
  if(!raw) return null

  let url = raw
  if(url.startsWith('//')) url = `https:${url}`
  if(url.startsWith('/')) url = `https://kodik.info${url}`

  try{
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if(!host.includes('kodik')) return null
    if(parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    parsed.protocol = 'https:'
    return parsed.toString()
  }catch{
    return null
  }
}

export async function resolveKodikPlayerForAnime(anime, { limit = 5 } = {}){
  const patch = await enrichAnimeWithKodik(anime, { limit })
  const embedUrl = normalizeKodikPlayerUrl(patch?.kodik_link)
  if(!patch || !embedUrl) return null

  return {
    provider: 'kodik',
    embedUrl,
    title: patch.title_ru || anime?.title || null,
    kodikId: patch.kodik_id || null,
    translationTitle: patch.translation_title || null,
    translationType: patch.translation_type || null,
    quality: patch.quality || null,
    raw: patch
  }
}

export function normalizeKodikMaterial(material, anime = {}){
  if(!material) return null
  const translation = bestTranslation(material)
  const materialData = material.material_data || {}
  const titleRu = clean(material.title || materialData.title || materialData.title_ru)
  const titleOrig = clean(material.title_orig || materialData.title_original || materialData.title_en)
  const year = asNumber(material.year || materialData.year || anime.year)
  const screenshots = normalizeScreenshots(material.screenshots)

  return {
    kodik_id: clean(material.id),
    kodik_link: clean(material.link),
    kodik_type: clean(material.type),
    title_ru: titleRu,
    title_orig_kodik: titleOrig,
    other_title: clean(material.other_title),
    kodik_year: year,
    kodik_shikimori_id: asNumber(material.shikimori_id),
    translation_id: translation.id,
    translation_title: translation.title,
    translation_type: translation.type,
    quality: clean(material.quality),
    kodik_screenshots: screenshots,
    screenshots,
    kodik_created_at: clean(material.created_at) || null,
    kodik_updated_at: clean(material.updated_at) || new Date().toISOString(),
    camrip: Boolean(material.camrip),
    lgbt: Boolean(material.lgbt),
    blocked_countries: Array.isArray(material.blocked_countries) ? material.blocked_countries : [],
    kodik_match_score: asNumber(material.__aianime_match_score),
    kodik_raw: material,
    updated_at: new Date().toISOString()
  }
}
