'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { readJson, saveAiQuery } from '@/lib/userStorage'
import { scoreAiItem, explainAiMatch, getCatalogHint, isAiItemRelevant, getQueryIntent } from '@/lib/searchRelevance'
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

function localScore(item, query, context){
  return scoreAiItem(item, query, context)
}

function localReason(item, query, context){
  return explainAiMatch(item, query, context)
}

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
  if(context.watchedSlugs?.has(item.slug)) bonus -= 9999
  if(context.positiveSlugs?.has(item.slug)) bonus -= 25
  ;(item.genres || []).forEach(genre => {
    bonus += Math.min(18, (context.genreWeights?.[genre] || 0) * 6)
  })
  return bonus
}

function normalizeResults(payload, items, submitted, options = {}){
  const libraryContext = options.useLibrary ? options.libraryContext : null
  const baseContext = options.similarSlug ? { baseAnime: items.find(item => item.slug === options.similarSlug) } : {}
  const intent = getQueryIntent(submitted)

  const mapItem = (sourceItem) => {
    const full = items.find(x => x.slug === sourceItem.slug) || sourceItem
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

  if(payload?.ok && Array.isArray(payload.results) && payload.results.length){
    return payload.results
      .map(mapItem)
      .filter(item => Number(item.aiScore) > -9000)
      .filter(item => isAiItemRelevant(item, submitted))
      .sort((a,b) => Number(b.aiScore || 0) - Number(a.aiScore || 0))
      .slice(0, 12)
  }

  return [...items]
    .map(item => ({ ...item, aiScore: localScore(item, submitted, baseContext) + personalizeScore(item, libraryContext) }))
    .filter(item => Number(item.aiScore) > -9000)
    .filter(item => isAiItemRelevant(item, submitted) || !intent.strongGenreRequest)
    .sort((a,b) => b.aiScore - a.aiScore)
    .slice(0, 12)
    .map(item => ({ ...item, reason: localReason(item, submitted, baseContext), match: Math.min(98, Math.max(62, Math.round(60 + item.aiScore / 18))) }))
}

export default function AiClient({ items, similarSlug, initialQuery: initialQueryProp }){
  const initialQuery = initialQueryProp || (similarSlug ? 'подбери похожие тайтлы' : 'хочу что-то интересное на вечер')
  const [query, setQuery] = useState(initialQuery)
  const [submitted, setSubmitted] = useState(initialQuery)
  const [remoteResults, setRemoteResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [library, setLibrary] = useState({})
  const [favorites, setFavorites] = useState([])
  const [useLibrary, setUseLibrary] = useState(false)

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
    setQuery(clean)
    setSubmitted(clean)
    setLoading(true)

    try{
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: clean, baseSlug: similarSlug || null, limit: 12 })
      })
      const payload = await res.json()
      setRemoteResults(payload)
    }catch(error){
      setRemoteResults(null)
    }finally{
      setLoading(false)
    }

    setHistory(saveAiQuery(clean))
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

  const libraryContext = useMemo(() => buildLibraryContext(items, library, favorites), [items, library, favorites])
  const hasPersonalData = Boolean(libraryContext.rows.length || libraryContext.favoriteSlugs.size)
  const results = useMemo(() => normalizeResults(remoteResults, items, submitted, { useLibrary, libraryContext, similarSlug }), [remoteResults, items, submitted, useLibrary, libraryContext, similarSlug])

  return <>
    <section className="ai-search-panel ai-search-panel-v186 widget">
      <div className="ai-search-copy">
        <span>AI anime finder</span>
        <h2>Опиши конкретно, что хочется</h2>
        <p>AI теперь жёстче держится запроса: если пишешь “романтика” — он ищет романтику, а не кидает всё подряд по рейтингу. Можно написать обычной фразой или собрать запрос кнопками.</p>
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
        <button className="primary" onClick={()=>runSearch(query)} disabled={loading}>{loading ? 'Подбираю…' : 'Подобрать ✨'}</button>
        <button className="secondary" onClick={()=>setQuery('')}>Очистить</button>
        <label className={`ai-personal-toggle ${useLibrary ? 'active' : ''} ${hasPersonalData ? '' : 'muted'}`}>
          <input type="checkbox" checked={useLibrary} onChange={e=>setUseLibrary(e.target.checked)} disabled={!hasPersonalData}/>
          <span>Учитывать мою библиотеку</span>
        </label>
      </div>

      <div className="ai-search-status">
        <p>{getCatalogHint(submitted)}</p>
        {hasPersonalData ? <p>{useLibrary ? 'Просмотренное и брошенное скрываем, любимые жанры поднимаем выше.' : 'Можно включить библиотеку, чтобы убрать уже просмотренное.'}</p> : <p>Добавь тайтлы в библиотеку или избранное — подбор станет персональнее.</p>}
      </div>

      {history.length ? <div className="ai-history ai-history-v186">
        <p>Недавние запросы</p>
        <div>{history.slice(0, 6).map(x=><button key={x} onClick={()=>runSearch(x)}>{x}</button>)}</div>
      </div> : null}
    </section>

    <div className="section-title section-title-clean-icons"><h2><HomeSectionIcon type="ai"/>AI рекомендует</h2><Link href="/catalog">Каталог ›</Link></div>
    <div className="ai-results-grid ai-results-grid-v186">
      {results.slice(0,8).map(item=><Link className="ai-result-card ai-result-card-v186" href={`/anime/${item.slug}`} key={item.slug} prefetch={false}>
        <img loading="lazy" decoding="async" width="320" height="480" src={item.poster} alt={item.title ? `Постер аниме ${getPrimaryTitle(item)}` : 'Постер аниме'}/>
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
      </Link>)}
    </div>
  </>
}
