'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { readJson } from '@/lib/userStorage'
import { normalizeSearchText } from '@/lib/searchRelevance'
import HomeSectionIcon from '@/components/HomeSectionIcon'

const PROMPT_GROUPS = [
  { title: 'Вайб', items: ['лёгкое и уютное', 'романтика и отношения', 'мрачное и напряжённое', 'смешное и бодрое'] },
  { title: 'Жанр', items: ['романтика', 'комедия', 'экшен', 'фэнтези', 'психология', 'триллер'] },
  { title: 'Формат', items: ['короткое до 13 серий', 'завершённое', 'онгоинг', 'фильм на вечер'] }
]

const QUICK_PRESETS = [
  { label: 'Романтика', query: 'аниме романтика про отношения' },
  { label: 'Лёгкое', query: 'лёгкое уютное аниме без тяжёлой драмы' },
  { label: 'Экшен', query: 'аниме экшен с боями и динамикой' },
  { label: 'Короткое', query: 'короткое аниме до 13 серий на вечер' },
  { label: 'Мрачное', query: 'мрачный психологический триллер' }
]

const TITLE_ALIASES = [
  ['ванпис', ['one piece', 'onepiece', 'ван пис']],
  ['ван пис', ['one piece', 'onepiece', 'ванпис']],
  ['one piece', ['ванпис', 'ван пис', 'onepiece']],
  ['onepiece', ['one piece', 'ван пис', 'ванпис']],
  ['атака титанов', ['shingeki', 'kyojin', 'титаны', 'attack titan']],
  ['атаку титанов', ['shingeki', 'kyojin', 'титаны', 'attack titan']],
  ['наруто', ['naruto']],
  ['блич', ['bleach']],
  ['фрирен', ['frieren', 'sousou']],
  ['тетрадь смерти', ['death note']],
  ['врата штейна', ['steins gate', 'steins']]
]

const GENRE_HINTS = [
  ['Романтика', ['романтик', 'романтика', 'любов', 'отношен', 'лавстори', 'ромком']],
  ['Комедия', ['комед', 'смешн', 'весел', 'весёл', 'юмор', 'угар', 'бодр']],
  ['Экшен', ['экшен', 'боев', 'боёв', 'драк', 'битв', 'сражен', 'динамик']],
  ['Фэнтези', ['фэнтези', 'маг', 'исекай', 'иной мир', 'приключ']],
  ['Психология', ['психолог', 'умн', 'майнд', 'mind']],
  ['Триллер', ['триллер', 'напряж', 'саспенс']],
  ['Драма', ['драма', 'слез', 'слёз', 'эмоцион']],
  ['Школа', ['школ', 'старшая школа']],
  ['Детектив', ['детектив', 'расслед', 'тайн', 'загад']],
  ['Ужасы', ['ужас', 'хоррор', 'страш']],
  ['Повседневность', ['повседнев', 'уют', 'спокой', 'лайф', 'slice']]
]

const HEAVY_GENRES = new Set(['Ужасы', 'Триллер', 'Психология', 'Драма', 'Экшен', 'Сверхъестественное'])
const LIGHT_GENRES = new Set(['Комедия', 'Повседневность', 'Романтика', 'Школа', 'Музыка'])

function getPrimaryTitle(item){
  return item?.titleRu || item?.displayTitle || item?.title || 'Без названия'
}

function safeArray(value){
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function normalizeLibrary(raw){
  return raw && typeof raw === 'object' ? raw : {}
}

function normalizeFavorites(raw){
  return Array.isArray(raw) ? raw.filter(item => item?.slug) : []
}

function expandQueryAliases(query){
  const q = normalizeSearchText(query)
  const parts = [query]
  for(const [needle, aliases] of TITLE_ALIASES){
    if(q.includes(normalizeSearchText(needle))) parts.push(...aliases)
  }
  return parts.filter(Boolean).join(' ')
}

function tokenize(value){
  return normalizeSearchText(value)
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length >= 2)
    .slice(0, 12)
}

function prepareItems(items){
  return (items || []).filter(item => item?.slug).map(item => {
    const genres = safeArray(item.genres)
    const title = getPrimaryTitle(item)
    const titleText = normalizeSearchText([
      item.title,
      item.titleRu,
      item.displayTitle,
      item.originalTitle,
      item.englishTitle,
      item.slug
    ].filter(Boolean).join(' '))
    const searchText = normalizeSearchText([
      title,
      item.title,
      item.titleRu,
      item.displayTitle,
      item.originalTitle,
      item.englishTitle,
      item.description,
      item.studio,
      item.year,
      item.status,
      item.kind,
      item.meta,
      item.slug,
      genres.join(' ')
    ].filter(Boolean).join(' '))
    return { ...item, title, genres, __titleText: titleText, __searchText: searchText }
  })
}

function getIntent(query){
  const q = normalizeSearchText(query)
  const wantedGenres = []
  for(const [genre, aliases] of GENRE_HINTS){
    if(aliases.some(alias => q.includes(normalizeSearchText(alias)))) wantedGenres.push(genre)
  }
  const uniqueGenres = Array.from(new Set(wantedGenres))
  return {
    raw: q,
    tokens: tokenize(query),
    wantedGenres: uniqueGenres,
    short: q.includes('коротк') || q.includes('до 13') || q.includes('мало серий') || q.includes('на вечер'),
    wantsMovie: q.includes('фильм') || q.includes('полнометраж'),
    wantsTv: q.includes('сериал') || q.includes('тв') || q.includes('tv'),
    wantsOngoing: q.includes('онгоинг') || q.includes('выходит') || q.includes('новые серии'),
    wantsCompleted: q.includes('заверш') || q.includes('законч') || q.includes('полностью'),
    light: q.includes('легк') || q.includes('лёгк') || q.includes('уют') || q.includes('позитив') || q.includes('добро') || q.includes('спокой'),
    dark: q.includes('мрач') || q.includes('темн') || q.includes('тёмн') || q.includes('триллер') || q.includes('психолог') || q.includes('хоррор'),
    noHeavy: q.includes('без жести') || q.includes('без жест') || q.includes('без тяжел') || q.includes('без тяж') || q.includes('без крови') || q.includes('без хоррор') || q.includes('без драмы')
  }
}

function genreScore(itemGenres, intent){
  let score = 0
  for(const genre of intent.wantedGenres){
    if(itemGenres.includes(genre)) score += 110
  }
  if(intent.wantedGenres.includes('Романтика') && !itemGenres.includes('Романтика')) score -= 140
  if(intent.wantedGenres.includes('Экшен') && !itemGenres.includes('Экшен')) score -= 55
  if(intent.wantedGenres.includes('Психология') && itemGenres.includes('Триллер')) score += 22
  if(intent.wantedGenres.includes('Триллер') && itemGenres.includes('Психология')) score += 22
  if(intent.wantedGenres.includes('Комедия') && itemGenres.includes('Романтика')) score += 16
  return score
}

function heavyScore(item){
  return safeArray(item.genres).filter(g => HEAVY_GENRES.has(g)).length * 18
}

function scoreItem(item, query, context){
  const expanded = expandQueryAliases(query)
  const intent = getIntent(expanded)
  const q = normalizeSearchText(expanded)
  const genres = safeArray(item.genres)
  let score = 0

  if(q && item.__titleText.includes(q)) score += 1200
  if(q && item.__searchText.includes(q)) score += 220

  for(const [needle, aliases] of TITLE_ALIASES){
    const n = normalizeSearchText(needle)
    if(q.includes(n)){
      if(item.__titleText.includes(n)) score += 900
      for(const alias of aliases){
        if(item.__titleText.includes(normalizeSearchText(alias))) score += 900
      }
    }
  }

  for(const token of intent.tokens){
    if(item.__titleText.includes(token)) score += 85
    else if(item.__searchText.includes(token)) score += 20
  }

  score += genreScore(genres, intent)

  if(intent.short){
    const episodes = Number(item.episodes || 0)
    if(item.kind === 'movie') score += 75
    if(episodes > 0 && episodes <= 13) score += 90
    if(episodes > 26) score -= 75
  }
  if(intent.wantsMovie){
    if(item.kind === 'movie') score += 120
    else score -= 50
  }
  if(intent.wantsTv){
    if(item.kind === 'tv') score += 90
    if(item.kind === 'movie') score -= 160
  }
  if(intent.wantsOngoing && item.status === 'ongoing') score += 80
  if(intent.wantsCompleted && item.status === 'completed') score += 55

  const heavy = heavyScore(item)
  if(intent.light || intent.noHeavy){
    if(genres.some(g => LIGHT_GENRES.has(g))) score += 55
    score -= heavy * (intent.noHeavy ? 2.2 : 1.25)
  }
  if(intent.dark){
    score += Math.min(110, heavy * 1.4)
  }

  if(context?.useLibrary){
    if(context.watchedSlugs?.has(item.slug)) score -= 25
    if(context.positiveSlugs?.has(item.slug)) score += 20
    genres.forEach(genre => { score += Math.min(18, (context.genreWeights?.[genre] || 0) * 5) })
  }

  score += Math.min(35, Number(item.score || 0) * 3)
  score += Math.min(20, Math.log1p(Number(item.popularity || 0)) * 2)
  return score
}

function makeReason(item, query){
  const intent = getIntent(expandQueryAliases(query))
  const genres = safeArray(item.genres)
  if(normalizeSearchText(query) && item.__titleText?.includes(normalizeSearchText(query))) return 'точное совпадение по названию'
  if(intent.short && (item.kind === 'movie' || Number(item.episodes || 0) <= 13)) return 'короткий формат для быстрого просмотра'
  if(intent.wantsTv && item.kind === 'tv') return 'сериал под выбранный формат'
  const hits = intent.wantedGenres.filter(g => genres.includes(g)).slice(0, 3)
  if(hits.length) return `подходит по жанрам: ${hits.join(', ')}`
  if(intent.dark) return 'мрачная атмосфера и напряжённый вайб'
  if(intent.light) return 'лёгкий вайб без лишней тяжести'
  return `жанры: ${genres.slice(0, 3).join(', ') || 'подходит по смыслу запроса'}`
}

function buildLibraryContext(items, library, favorites){
  const bySlug = new Map((items || []).map(item => [item.slug, item]))
  const favoriteSlugs = new Set(normalizeFavorites(favorites).map(item => item.slug))
  const rows = Object.values(normalizeLibrary(library)).filter(item => item?.slug)
  const watchedSlugs = new Set(rows.filter(item => ['completed', 'dropped'].includes(item.status)).map(item => item.slug))
  const positiveSlugs = new Set([
    ...rows.filter(item => ['watching', 'planned'].includes(item.status)).map(item => item.slug),
    ...favoriteSlugs
  ])
  const genreWeights = {}
  positiveSlugs.forEach(slug => {
    const anime = bySlug.get(slug)
    safeArray(anime?.genres).forEach(genre => { genreWeights[genre] = (genreWeights[genre] || 0) + 1 })
  })
  return { rows, favoriteSlugs, watchedSlugs, positiveSlugs, genreWeights }
}

function buildInstantResults(preparedItems, query, options = {}){
  const clean = String(query || '').trim() || 'хочу что-то интересное на вечер'
  const scored = preparedItems.map(item => {
    const aiScore = scoreItem(item, clean, options.libraryContext && options.useLibrary ? options.libraryContext : null)
    return {
      ...item,
      aiScore,
      match: Math.min(98, Math.max(61, Math.round(64 + aiScore / 18))),
      reason: makeReason(item, clean)
    }
  }).sort((a, b) => Number(b.aiScore || 0) - Number(a.aiScore || 0))

  const positive = scored.filter(item => Number(item.aiScore || 0) > 25)
  const pool = positive.length >= 8 ? positive : scored
  const seen = new Set()
  return pool.filter(item => {
    if(!item?.slug || seen.has(item.slug)) return false
    seen.add(item.slug)
    return true
  }).slice(0, 12)
}

export default function AiClient({ items, similarSlug, initialQuery: initialQueryProp }){
  const initialQuery = initialQueryProp || (similarSlug ? 'подбери похожие тайтлы' : 'хочу что-то интересное на вечер')
  const [query, setQuery] = useState(initialQuery)
  const [submitted, setSubmitted] = useState(initialQuery)
  const [library, setLibrary] = useState({})
  const [favorites, setFavorites] = useState([])
  const [useLibrary, setUseLibrary] = useState(false)

  const preparedItems = useMemo(() => prepareItems(items), [items])
  const libraryContext = useMemo(() => buildLibraryContext(preparedItems, library, favorites), [preparedItems, library, favorites])
  const hasPersonalData = Boolean(libraryContext.rows.length || libraryContext.favoriteSlugs.size)

  useEffect(() => {
    setLibrary(readJson('anime:library', {}))
    setFavorites(readJson('anime:favorites', []))
    setQuery(initialQuery)
    setSubmitted(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    function updatePersonal(){
      setLibrary(readJson('anime:library', {}))
      setFavorites(readJson('anime:favorites', []))
    }
    window.addEventListener('anime:library-updated', updatePersonal)
    window.addEventListener('anime:user-updated', updatePersonal)
    return () => {
      window.removeEventListener('anime:library-updated', updatePersonal)
      window.removeEventListener('anime:user-updated', updatePersonal)
    }
  }, [])

  // Не сортируем каталог на каждый символ сразу: это и давало фризы при печати.
  // Через 220 мс после паузы выдача обновляется сама, а кнопка обновляет мгновенно.
  useEffect(() => {
    const clean = String(query || '').trim()
    if(clean.length < 2) return
    const timer = window.setTimeout(() => setSubmitted(clean), 220)
    return () => window.clearTimeout(timer)
  }, [query])

  const results = useMemo(
    () => buildInstantResults(preparedItems, submitted, { useLibrary, libraryContext }),
    [preparedItems, submitted, useLibrary, libraryContext]
  )

  function runSearch(nextQuery = query){
    const clean = String(nextQuery || '').trim()
    if(!clean) return
    setQuery(clean)
    setSubmitted(clean)
  }

  function applyPreset(text){
    setQuery(text)
    setSubmitted(text)
  }

  function addToQuery(text){
    const clean = String(text || '').trim()
    if(!clean) return
    const next = query.trim() ? `${query.trim()}, ${clean}` : clean
    setQuery(next)
    setSubmitted(next)
  }

  return <>
    <section className="ai-search-panel ai-search-panel-v186 ai-search-panel-v204 widget">
      <div className="ai-search-copy">
        <span>AI anime finder</span>
        <h2>Опиши конкретно, что хочется</h2>
        <p>Опиши настроение, жанры, похожий тайтл или ситуацию — AI сразу покажет варианты из каталога.</p>
      </div>

      <div className="ai-preset-row" aria-label="Быстрые сценарии AI-подбора">
        {QUICK_PRESETS.map(item => <button key={item.label} type="button" onClick={() => applyPreset(item.query)}>{item.label}</button>)}
      </div>

      <textarea value={query} onChange={e=>setQuery(e.target.value)} placeholder="Например: Ванпис, романтика до 13 серий, мрачный триллер"/>

      <div className="ai-smart-builder" aria-label="Уточнить AI-запрос">
        {PROMPT_GROUPS.map(group => <div className="ai-smart-row" key={group.title}>
          <b>{group.title}</b>
          <div>
            {group.items.map(text => <button key={text} type="button" onClick={() => addToQuery(text)}>{text}</button>)}
          </div>
        </div>)}
      </div>

      <div className="ai-actions ai-actions-v186">
        <button className="primary" type="button" onClick={()=>runSearch(query)}>Подобрать ✨</button>
        <button className="secondary" type="button" onClick={()=>{ setQuery(''); setSubmitted(initialQuery) }}>Очистить</button>
        <label className={`ai-personal-toggle ${useLibrary ? 'active' : ''} ${hasPersonalData ? '' : 'muted'}`}>
          <input type="checkbox" checked={useLibrary} onChange={e=>setUseLibrary(e.target.checked)} disabled={!hasPersonalData}/>
          <span>Учитывать мою библиотеку</span>
        </label>
      </div>
    </section>

    <div className="section-title section-title-clean-icons"><h2><HomeSectionIcon type="ai"/>AI рекомендует</h2><Link href="/catalog">Каталог ›</Link></div>

    <div className="ai-results-grid ai-results-grid-v186 ai-results-grid-v204">
      {results.slice(0,8).map(item => <Link className="ai-result-card ai-result-card-v186 ai-result-card-v204" key={item.slug} href={`/anime/${item.slug}`} prefetch={false}>
        <img loading="eager" decoding="async" width="320" height="480" src={item.poster} alt={item.title ? `Постер аниме ${getPrimaryTitle(item)}` : 'Постер аниме'}/>
        <div>
          <span>AI {item.match || 80}%</span>
          <b>{getPrimaryTitle(item)}</b>
          <p>{item.reason || 'подходит по смыслу запроса'}</p>
          <div className="ai-result-meta">
            {item.year ? <em>{item.year}</em> : null}
            {item.episodes ? <em>{item.episodes} сер.</em> : null}
            {safeArray(item.genres).slice(0,2).map(genre => <em key={genre}>{genre}</em>)}
          </div>
        </div>
      </Link>)}
    </div>
  </>
}
