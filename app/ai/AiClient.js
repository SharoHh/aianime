'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { readJson } from '@/lib/userStorage'
import { scoreAiItem, explainAiMatch, isAiItemRelevant, getQueryIntent, getItemSearchText, normalizeSearchText } from '@/lib/searchRelevance'
import HomeSectionIcon from '@/components/HomeSectionIcon'

const PROMPT_GROUPS = [
  {
    title: 'Вайб',
    items: [
      'лёгкое и уютное',
      'романтика и отношения',
      'мрачное и напряжённое',
      'смешное и бодрое'
    ]
  },
  {
    title: 'Жанр',
    items: [
      'романтика',
      'комедия',
      'экшен',
      'фэнтези',
      'психология',
      'триллер'
    ]
  },
  {
    title: 'Формат',
    items: [
      'короткое до 13 серий',
      'завершённое',
      'онгоинг',
      'фильм на вечер'
    ]
  }
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
  ['onepiece', ['one piece', 'ван пис', 'ванпис']],
  ['атака титанов', ['shingeki', 'kyojin', 'титаны']],
  ['атаку титанов', ['shingeki', 'kyojin', 'титаны']],
  ['наруто', ['naruto']],
  ['блич', ['bleach']],
  ['фрирен', ['frieren', 'sousou']],
  ['тетрадь смерти', ['death note']],
  ['врата штейна', ['steins gate', 'steins']]
]

function getPrimaryTitle(item){
  return item?.titleRu || item?.displayTitle || item?.title || 'Без названия'
}

function normalizeLibrary(raw){
  if(!raw || typeof raw !== 'object') return {}
  return raw
}

function normalizeFavorites(raw){
  if(!Array.isArray(raw)) return []
  return raw.filter(item => item?.slug)
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
    ;(anime?.genres || []).forEach(genre => {
      genreWeights[genre] = (genreWeights[genre] || 0) + 1
    })
  })

  return { rows, favoriteSlugs, watchedSlugs, positiveSlugs, genreWeights }
}

function personalizeScore(item, context){
  if(!item?.slug || !context) return 0
  let bonus = 0
  // Не скрываем тайтл полностью: пользователь может прямо искать уже просмотренное.
  if(context.watchedSlugs?.has(item.slug)) bonus -= 30
  if(context.positiveSlugs?.has(item.slug)) bonus += 18
  ;(item.genres || []).forEach(genre => {
    bonus += Math.min(18, (context.genreWeights?.[genre] || 0) * 6)
  })
  return bonus
}

function expandQueryAliases(query){
  const q = normalizeSearchText(query)
  const parts = [query]
  for(const [needle, aliases] of TITLE_ALIASES){
    if(q.includes(normalizeSearchText(needle))){
      parts.push(...aliases)
    }
  }
  return parts.filter(Boolean).join(' ')
}

function titleExactScore(item, query){
  const q = normalizeSearchText(query)
  if(!q) return 0
  const titleText = getItemSearchText({
    title: item.title,
    titleRu: item.titleRu,
    displayTitle: item.displayTitle,
    originalTitle: item.originalTitle,
    englishTitle: item.englishTitle,
    slug: item.slug
  })
  let score = 0
  if(titleText.includes(q)) score += 900
  for(const [needle, aliases] of TITLE_ALIASES){
    const n = normalizeSearchText(needle)
    if(q.includes(n)){
      if(titleText.includes(n)) score += 900
      aliases.forEach(alias => {
        if(titleText.includes(normalizeSearchText(alias))) score += 900
      })
    }
  }
  return score
}

function buildInstantResults(items, query, options = {}){
  const clean = String(query || '').trim() || 'хочу что-то интересное на вечер'
  const expandedQuery = expandQueryAliases(clean)
  const libraryContext = options.useLibrary ? options.libraryContext : null
  const intent = getQueryIntent(expandedQuery)

  const scored = (items || [])
    .filter(item => item?.slug)
    .map(item => {
      const exact = titleExactScore(item, expandedQuery)
      const base = scoreAiItem(item, expandedQuery, {})
      const personal = personalizeScore(item, libraryContext)
      const relevant = isAiItemRelevant(item, expandedQuery)
      const aiScore = exact + base + personal + (relevant ? 45 : 0)
      return {
        ...item,
        aiScore,
        match: Math.min(98, Math.max(60, Math.round(62 + aiScore / 22))),
        reason: exact > 0
          ? 'точное совпадение по названию или близкому названию'
          : explainAiMatch(item, expandedQuery)
      }
    })
    .sort((a,b) => Number(b.aiScore || 0) - Number(a.aiScore || 0))

  const exactRows = scored.filter(item => titleExactScore(item, expandedQuery) > 0)
  const relevantRows = scored.filter(item => !exactRows.some(x => x.slug === item.slug) && isAiItemRelevant(item, expandedQuery))
  const goodRows = scored.filter(item => !exactRows.some(x => x.slug === item.slug) && !relevantRows.some(x => x.slug === item.slug) && Number(item.aiScore || 0) > 25)
  const fallbackRows = scored.filter(item => !exactRows.some(x => x.slug === item.slug) && !relevantRows.some(x => x.slug === item.slug) && !goodRows.some(x => x.slug === item.slug))

  const seen = new Set()
  const merged = [...exactRows, ...relevantRows, ...goodRows, ...fallbackRows].filter(item => {
    if(!item?.slug || seen.has(item.slug)) return false
    seen.add(item.slug)
    return true
  })

  // Главное правило страницы /ai: не показываем пустоту. Даже если запрос кривой,
  // пользователь сразу получает полный набор вариантов.
  return merged.slice(0, 12)
}

export default function AiClient({ items, similarSlug, initialQuery: initialQueryProp }){
  const initialQuery = initialQueryProp || (similarSlug ? 'подбери похожие тайтлы' : 'хочу что-то интересное на вечер')
  const [query, setQuery] = useState(initialQuery)
  const [submitted, setSubmitted] = useState(initialQuery)
  const [library, setLibrary] = useState({})
  const [favorites, setFavorites] = useState([])
  const [useLibrary, setUseLibrary] = useState(false)

  useEffect(() => {
    setLibrary(readJson('anime:library', {}))
    setFavorites(readJson('anime:favorites', []))
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

  function runSearch(nextQuery = query){
    const clean = String(nextQuery || '').trim()
    if(!clean) return
    setQuery(clean)
    setSubmitted(clean)
  }

  function handleQueryChange(value){
    setQuery(value)
    const clean = String(value || '').trim()
    if(clean.length >= 2) setSubmitted(clean)
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

  const libraryContext = useMemo(() => buildLibraryContext(items, library, favorites), [items, library, favorites])
  const hasPersonalData = Boolean(libraryContext.rows.length || libraryContext.favoriteSlugs.size)
  const results = useMemo(() => buildInstantResults(items, submitted, { useLibrary, libraryContext }), [items, submitted, useLibrary, libraryContext])

  return <>
    <section className="ai-search-panel ai-search-panel-v186 widget">
      <div className="ai-search-copy">
        <span>AI anime finder</span>
        <h2>Опиши конкретно, что хочется</h2>
        <p>Опиши настроение, жанры, похожий тайтл или ситуацию — AI сразу покажет варианты из каталога.</p>
      </div>

      <div className="ai-preset-row" aria-label="Быстрые сценарии AI-подбора">
        {QUICK_PRESETS.map(item => <button key={item.label} type="button" onClick={() => applyPreset(item.query)}>{item.label}</button>)}
      </div>

      <textarea value={query} onChange={e=>handleQueryChange(e.target.value)} placeholder="Например: Ванпис, романтика до 13 серий, мрачный триллер"/>

      <div className="ai-smart-builder" aria-label="Уточнить AI-запрос">
        {PROMPT_GROUPS.map(group => <div className="ai-smart-row" key={group.title}>
          <b>{group.title}</b>
          <div>
            {group.items.map(text => <button key={text} type="button" onClick={() => addToQuery(text)}>{text}</button>)}
          </div>
        </div>)}
      </div>

      <div className="ai-actions ai-actions-v186">
        <button className="primary" onClick={()=>runSearch(query)}>Подобрать ✨</button>
        <button className="secondary" onClick={()=>{ setQuery(''); setSubmitted(initialQuery) }}>Очистить</button>
        <label className={`ai-personal-toggle ${useLibrary ? 'active' : ''} ${hasPersonalData ? '' : 'muted'}`}>
          <input type="checkbox" checked={useLibrary} onChange={e=>setUseLibrary(e.target.checked)} disabled={!hasPersonalData}/>
          <span>Учитывать мою библиотеку</span>
        </label>
      </div>
    </section>

    <div className="section-title section-title-clean-icons"><h2><HomeSectionIcon type="ai"/>AI рекомендует</h2><Link href="/catalog">Каталог ›</Link></div>

    <div className="ai-results-grid ai-results-grid-v186">
      {results.slice(0,8).map(item=><article className="ai-result-card ai-result-card-v186" key={item.slug}>
        <Link className="ai-result-main-link" href={`/anime/${item.slug}`} prefetch={false}>
          <img loading="eager" decoding="async" width="320" height="480" src={item.poster} alt={item.title ? `Постер аниме ${getPrimaryTitle(item)}` : 'Постер аниме'}/>
          <div>
            <span>AI {item.match || 80}%</span>
            <b>{getPrimaryTitle(item)}</b>
            <p>{item.reason || explainAiMatch(item, submitted)}</p>
            <div className="ai-result-meta">
              {item.year ? <em>{item.year}</em> : null}
              {item.episodes ? <em>{item.episodes} сер.</em> : null}
              {(item.genres || []).slice(0,2).map(genre => <em key={genre}>{genre}</em>)}
            </div>
          </div>
        </Link>
      </article>)}
    </div>
  </>
}
