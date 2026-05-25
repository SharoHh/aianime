'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { readJson, saveAiQuery } from '@/lib/userStorage'
import { scoreAiItem, explainAiMatch, getCatalogHint } from '@/lib/searchRelevance'

function localScore(item, query){
  return scoreAiItem(item, query)
}

function localReason(item, query){
  return explainAiMatch(item, query)
}

function normalizeResults(payload, items, submitted){
  if(payload?.ok && Array.isArray(payload.results) && payload.results.length){
    return payload.results.map(apiItem => {
      const full = items.find(x => x.slug === apiItem.slug) || apiItem
      return { ...full, ...apiItem, reason: apiItem.reason || localReason(full, submitted), match: apiItem.match || 80 }
    })
  }

  return [...items]
    .map(item => ({ ...item, aiScore: localScore(item, submitted), match: Math.min(99, Math.max(55, Math.round(localScore(item, submitted)))) }))
    .sort((a,b) => b.aiScore - a.aiScore)
    .slice(0, 12)
    .map(item => ({ ...item, reason: localReason(item, submitted), match: Math.min(99, Math.max(55, Math.round(item.aiScore / 3))) }))
}

export default function AiClient({ items, similarSlug, initialQuery: initialQueryProp }){
  const initialQuery = initialQueryProp || (similarSlug ? 'подбери похожие тайтлы' : 'хочу что-то интересное на вечер')
  const [query, setQuery] = useState(initialQuery)
  const [submitted, setSubmitted] = useState(initialQuery)
  const [remoteResults, setRemoteResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    setHistory(readJson('ai_query_history', []))
    if(initialQuery) runSearch(initialQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const results = useMemo(() => normalizeResults(remoteResults, items, submitted), [remoteResults, items, submitted])
  const examples = ['лёгкое позитивное аниме без тяжёлой драмы', 'романтика без кринжа', 'мрачное фэнтези с сильным героем', 'короткое на вечер', 'психологический триллер', 'как Наруто, но взрослее']

  return <>
    <section className="ai-search-panel widget">
      <div className="ai-search-copy">
        <span>AI anime finder</span>
        <h2>Опиши, что хочется посмотреть</h2>
        <p>Можно писать обычным языком: настроение, любимый тайтл, жанр, темп или то, чего точно не хочется. Подбор учитывает тяжесть сюжета, длину, жанры и статус.</p>
      </div>
      <textarea value={query} onChange={e=>setQuery(e.target.value)} placeholder="Например: хочу лёгкое приключение без жестокости"/>
      <div className="ai-actions">
        <button className="primary" onClick={()=>runSearch(query)} disabled={loading}>{loading ? 'Подбираю…' : 'Подобрать ✨'}</button>
        <button className="secondary" onClick={()=>runSearch('лёгкое позитивное аниме без тяжёлой драмы')}>Лёгкое</button>
        <button className="secondary" onClick={()=>runSearch('популярное динамичное аниме с экшеном')}>Экшен</button>
      </div>
      <div className="ai-chip-row">{examples.map(x=><button key={x} onClick={()=>runSearch(x)}>{x}</button>)}</div>
      <p className="ai-search-hint">{getCatalogHint(submitted)}</p>
      {history.length ? <div className="ai-history">
        <p>История запросов</p>
        <div>{history.map(x=><button key={x} onClick={()=>runSearch(x)}>{x}</button>)}</div>
      </div> : null}
    </section>

    <div className="section-title"><h2><span>✦</span>AI рекомендует</h2><Link href="/catalog">Каталог ›</Link></div>
    <div className="ai-results-grid">
      {results.slice(0,6).map(item=><Link className="ai-result-card" href={`/anime/${item.slug}`} key={item.slug}>
        <img loading="lazy" decoding="async" src={item.poster} alt="Аниме"/>
        <div>
          <span>AI {item.match || 80}%</span>
          <b>{item.title}</b>
          <p>{item.reason || localReason(item, submitted)}</p>
          <em>{(item.genres || []).slice(0,2).join(' · ') || item.meta}</em>
        </div>
      </Link>)}
    </div>
  </>
}
