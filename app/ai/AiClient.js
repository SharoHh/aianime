'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { readJson, saveAiQuery } from '@/lib/userStorage'
import { scoreAiItem, explainAiMatch, isAiItemRelevant, getQueryIntent } from '@/lib/searchRelevance'
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

const AI_TUNING_ACTIONS = [
  { label: 'Легче', suffix: 'сделай подборку легче, уютнее и без тяжёлой драмы' },
  { label: 'Мрачнее', suffix: 'сделай подборку мрачнее, напряжённее и психологичнее' },
  { label: 'Больше романтики', suffix: 'добавь больше романтики, отношений и эмоциональной химии' },
  { label: 'Больше динамики', suffix: 'добавь больше динамики, экшена и бодрого темпа' },
  { label: 'Без жести', suffix: 'убери жестокость, хоррор, мрачняк и тяжёлую драму' },
  { label: 'Без фильмов', suffix: 'только сериалы, без полнометражных фильмов и одиночных спецвыпусков' },
  { label: 'Только короткие', suffix: 'только короткие сериалы до 13 серий или очень компактный формат' },
  { label: 'Больше нового', suffix: 'покажи более свежие тайтлы последних лет' }
]

const AI_REFINEMENT_TIMEOUT_MS = 4500

function localScore(item, query, context){
  return scoreAiItem(item, query, context)
}

function localReason(item, query, context){
  return explainAiMatch(item, query, context)
}

function getPrimaryTitle(item){
  return item?.titleRu || item?.displayTitle || item?.title || 'Без названия'
}

function buildVibeTags(query, results){
  const q = String(query || '').toLowerCase()
  const tags = []
  const add = (tag) => {
    if(tag && !tags.includes(tag)) tags.push(tag)
  }

  if(/роман|любов|отнош|лавстори|сёдзё|седзе/.test(q)) add('романтика')
  if(/школ|учеб|класс/.test(q)) add('школа')
  if(/л[её]гк|уют|добро|спокой/.test(q)) add('лёгкий вайб')
  if(/мрач|психолог|триллер|напряж|детектив/.test(q)) add('напряжение')
  if(/корот|13|вечер|быстр|фильм/.test(q)) add('короткий формат')
  if(/экшен|бо[ий]|динами|драйв/.test(q)) add('динамика')
  if(/без жест|без хорр|без драм|без мрач/.test(q)) add('без тяжести')

  const genreCount = new Map()
  ;(results || []).slice(0, 6).forEach(item => {
    ;(item?.genres || []).slice(0, 4).forEach(genre => {
      if(!genre) return
      genreCount.set(genre, (genreCount.get(genre) || 0) + 1)
    })
  })
  ;[...genreCount.entries()]
    .sort((a,b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([genre]) => add(genre.toLowerCase()))

  return tags.slice(0, 6)
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
  if(context.watchedSlugs?.has(item.slug)) bonus -= 9999
  if(context.positiveSlugs?.has(item.slug)) bonus -= 25
  ;(item.genres || []).forEach(genre => {
    bonus += Math.min(18, (context.genreWeights?.[genre] || 0) * 6)
  })
  return bonus
}

function normalizeResults(payload, items, submitted, options = {}){
  const excludedSlugs = options.excludedSlugs || new Set()
  const libraryContext = options.useLibrary ? options.libraryContext : null
  const baseContext = options.similarSlug ? { baseAnime: items.find(item => item.slug === options.similarSlug) } : {}
  const intent = getQueryIntent(submitted)

  const mapItem = (sourceItem) => {
    const full = items.find(x => x.slug === sourceItem.slug) || sourceItem
    if(full?.slug && excludedSlugs.has(full.slug)) return null
    const baseScore = Number(sourceItem.aiScore || sourceItem.match || localScore(full, submitted, baseContext))
    const personal = personalizeScore(full, libraryContext)
    return {
      ...full,
      ...sourceItem,
      aiScore: baseScore + personal,
      reason: sourceItem.reason || localReason(full, submitted, baseContext),
      match: Math.min(98, Math.max(62, Math.round(60 + (baseScore + Math.max(0, personal)) / 18)))
    }
  }

  const localPool = [...items]
    .map(item => ({ ...item, aiScore: localScore(item, submitted, baseContext) + personalizeScore(item, libraryContext) }))
    .filter(item => Number(item.aiScore) > -9000 && !(item?.slug && excludedSlugs.has(item.slug)))
    .sort((a,b) => b.aiScore - a.aiScore)
    .map(item => ({ ...item, reason: localReason(item, submitted, baseContext), match: Math.min(98, Math.max(56, Math.round(60 + item.aiScore / 18))) }))

  const relevantLocal = localPool.filter(item => isAiItemRelevant(item, submitted))
  const softLocal = localPool.filter(item => !relevantLocal.some(x => x.slug === item.slug) && Number(item.aiScore || 0) > 20)

  const mergeUnique = (rows) => {
    const seen = new Set()
    return rows.filter(item => {
      if(!item?.slug || seen.has(item.slug)) return false
      seen.add(item.slug)
      return true
    })
  }

  if(payload?.ok && Array.isArray(payload.results) && payload.results.length){
    const remote = payload.results
      .map(mapItem)
      .filter(item => item && Number(item.aiScore) > -9000)
      .sort((a,b) => Number(b.aiScore || 0) - Number(a.aiScore || 0))

    const merged = mergeUnique([
      ...remote.filter(item => isAiItemRelevant(item, submitted)),
      ...remote,
      ...relevantLocal,
      ...softLocal,
      ...localPool
    ])
    return merged.slice(0, 12)
  }

  const merged = mergeUnique([
    ...(relevantLocal.length ? relevantLocal : []),
    ...softLocal,
    ...localPool
  ])
  return merged.slice(0, 12)
}

export default function AiClient({ items, similarSlug, initialQuery: initialQueryProp }){
  const initialQuery = initialQueryProp || (similarSlug ? 'подбери похожие тайтлы' : 'хочу что-то интересное на вечер')
  const [query, setQuery] = useState(initialQuery)
  const [submitted, setSubmitted] = useState(initialQuery)
  const [remoteResults, setRemoteResults] = useState(null)
  const searchSeq = useRef(0)
  const [history, setHistory] = useState([])
  const [library, setLibrary] = useState({})
  const [favorites, setFavorites] = useState([])
  const [useLibrary, setUseLibrary] = useState(false)
  const [excludedSlugs, setExcludedSlugs] = useState(() => new Set())

  useEffect(() => {
    setHistory(readJson('ai_query_history', []))
    const nextLibrary = readJson('anime:library', {})
    const nextFavorites = readJson('anime:favorites', [])
    setLibrary(nextLibrary)
    setFavorites(nextFavorites)
    setUseLibrary(Boolean(Object.keys(nextLibrary || {}).length || (Array.isArray(nextFavorites) && nextFavorites.length)))
    if(initialQuery) runSearch(initialQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function updatePersonal(){
      const nextLibrary = readJson('anime:library', {})
      const nextFavorites = readJson('anime:favorites', [])
      setLibrary(nextLibrary)
      setFavorites(nextFavorites)
    }
    window.addEventListener('anime:library-updated', updatePersonal)
    window.addEventListener('anime:user-updated', updatePersonal)
    return () => {
      window.removeEventListener('anime:library-updated', updatePersonal)
      window.removeEventListener('anime:user-updated', updatePersonal)
    }
  }, [])

  async function runSearch(nextQuery = query){
    const clean = String(nextQuery || '').trim()
    if(!clean) return

    const seq = searchSeq.current + 1
    searchSeq.current = seq

    setQuery(clean)
    setSubmitted(clean)
    setHistory(saveAiQuery(clean))
    setExcludedSlugs(new Set())

    // Мгновенно показываем сильный локальный подбор из уже загруженного каталога.
    // OpenAI уточняет результат в фоне, но пользователь больше не ждёт пустую кнопку 20–30 секунд.
    setRemoteResults({
      ok: true,
      source: 'instant-local',
      summary: ''
    })

    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), AI_REFINEMENT_TIMEOUT_MS)

    try{
      const libraryRows = Object.values(normalizeLibrary(library)).filter(item => item?.slug).map(item => ({ slug:item.slug, status:item.status }))
      const favoriteSlugs = normalizeFavorites(favorites).map(item => item.slug)
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: clean,
          baseSlug: similarSlug || null,
          limit: 12,
          context: useLibrary ? { library: libraryRows, favorites: favoriteSlugs } : null
        })
      })
      const payload = await res.json()
      if(seq !== searchSeq.current) return
      if(payload?.ok && payload?.source === 'external-openai' && Array.isArray(payload.results) && payload.results.length){
        setRemoteResults(payload)
      }
    }catch(error){
      // Ничего не ломаем: мгновенный локальный результат уже показан.
    }finally{
      window.clearTimeout(timer)
    }
  }

  function applyPreset(text){
    runSearch(text)
  }

  function addToQuery(text){
    const clean = String(text || '').trim()
    if(!clean) return
    const next = query.trim() ? `${query.trim()}, ${clean}` : clean
    setQuery(next)
  }

  function tuneResults(suffix){
    const clean = String(suffix || '').trim()
    if(!clean) return
    const base = (submitted || query || initialQuery).trim()
    runSearch(base ? `${base}, ${clean}` : clean)
  }

  function moreLike(item){
    const title = getPrimaryTitle(item)
    const base = (submitted || query || '').trim()
    runSearch(`похоже на ${title}${base ? `, ${base}` : ''}`)
  }

  function hideSimilar(item){
    if(!item?.slug) return
    setExcludedSlugs(prev => {
      const next = new Set(prev)
      next.add(item.slug)
      return next
    })
    setRemoteResults({ ok:true, source:'instant-local', summary:'' })
  }

  const libraryContext = useMemo(() => buildLibraryContext(items, library, favorites), [items, library, favorites])
  const hasPersonalData = Boolean(libraryContext.rows.length || libraryContext.favoriteSlugs.size)
  const results = useMemo(() => normalizeResults(remoteResults, items, submitted, { useLibrary, libraryContext, similarSlug, excludedSlugs }), [remoteResults, items, submitted, useLibrary, libraryContext, similarSlug, excludedSlugs])
  const vibeTags = useMemo(() => buildVibeTags(submitted, results), [submitted, results])

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

      <textarea value={query} onChange={e=>setQuery(e.target.value)} placeholder="Например: аниме романтика про отношения, без жести, до 13 серий"/>

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
        <button className="secondary" onClick={()=>setQuery('')}>Очистить</button>
        <label className={`ai-personal-toggle ${useLibrary ? 'active' : ''} ${hasPersonalData ? '' : 'muted'}`}>
          <input type="checkbox" checked={useLibrary} onChange={e=>setUseLibrary(e.target.checked)} disabled={!hasPersonalData}/>
          <span>Учитывать мою библиотеку</span>
        </label>
      </div>

      {history.length ? <div className="ai-history ai-history-v186">
        <p>Недавние запросы</p>
        <div>{history.slice(0, 6).map(x=><button key={x} onClick={()=>runSearch(x)}>{x}</button>)}</div>
      </div> : null}
    </section>

    <div className="section-title section-title-clean-icons"><h2><HomeSectionIcon type="ai"/>AI рекомендует</h2><Link href="/catalog">Каталог ›</Link></div>

    <section className="ai-tune-panel" aria-label="Подкрутить AI-подбор">
      <div className="ai-tune-head">
        <div>
          <span>Вайб подборки</span>
          <strong>{vibeTags.length ? vibeTags.join(' · ') : 'подбор под твой запрос'}</strong>
        </div>
        <button type="button" onClick={() => runSearch(submitted || query)}>Обновить</button>
      </div>
      <div className="ai-tune-actions">
        {AI_TUNING_ACTIONS.map(action => (
          <button key={action.label} type="button" onClick={() => tuneResults(action.suffix)}>{action.label}</button>
        ))}
      </div>
    </section>

    <div className="ai-results-grid ai-results-grid-v186">
      {results.slice(0,8).map(item=><article className="ai-result-card ai-result-card-v186 ai-result-card-tunable" key={item.slug}>
        <Link className="ai-result-main-link" href={`/anime/${item.slug}`} prefetch={false}>
          <img loading="eager" decoding="async" width="320" height="480" src={item.poster} alt={item.title ? `Постер аниме ${getPrimaryTitle(item)}` : 'Постер аниме'}/>
          <div>
            <span>AI {item.match || 80}%</span>
            <b>{getPrimaryTitle(item)}</b>
            <p>{item.reason || localReason(item, submitted)}</p>
            <div className="ai-result-meta">
              {item.year ? <em>{item.year}</em> : null}
              {item.episodes ? <em>{item.episodes} сер.</em> : null}
              {(item.genres || []).slice(0,2).map(genre => <em key={genre}>{genre}</em>)}
            </div>
          </div>
        </Link>
        <div className="ai-card-feedback" aria-label={`Настроить подбор относительно ${getPrimaryTitle(item)}`}>
          <button type="button" onClick={() => moreLike(item)}>Ещё похожие</button>
          <button type="button" onClick={() => hideSimilar(item)}>Не то</button>
        </div>
      </article>)}
    </div>
  </>
}
