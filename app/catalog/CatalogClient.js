// AIanime v116: catalog uses one clean global rating badge, no duplicate old rating class.
'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { filterAndSortAnime, getCatalogHint } from '@/lib/searchRelevance'
import GlobalRatingBadge from '@/components/GlobalRatingBadge'
import { isPublicReadyAnimeItem } from '@/lib/animeQuality'

const statusLabels = { all:'Все статусы', ongoing:'Онгоинг', completed:'Завершено', released:'Фильм' }
const kindLabels = { all:'Любой тип', tv:'TV сериал', movie:'Фильм', ova:'OVA' }
const sortLabels = { relevant:'Сначала релевантные', popular:'Популярные', rating:'По рейтингу', newest:'Сначала новые', episodes:'Больше серий' }

function hasGlobalRating(item){return item?.siteRatingCount > 0 && String(item?.rating || '') !== '—'}
function ratingToneClass(item){
  const value = Number(item?.rating || 0)
  if(!Number.isFinite(value) || value <= 0) return 'rating-tone-low'
  if(value >= 8.5) return 'rating-tone-gold'
  if(value >= 6.5) return 'rating-tone-orange'
  return 'rating-tone-red'
}

function unique(list){ return Array.from(new Set(list)).filter(Boolean) }

function animeHref(slug){
  const safe = String(slug || '').trim()
  if(!safe || safe === 'undefined' || safe === 'null') return '/catalog'
  return `/anime/${encodeURIComponent(safe)}`
}

function visibleCatalogItem(item){
  return isPublicReadyAnimeItem(item)
}

export default function CatalogClient({ items }){
  const searchParams = useSearchParams()
  const paramsKey = searchParams.toString()
  const readParam = (name, fallback = 'all') => searchParams.get(name) || fallback
  const [query,setQuery] = useState(()=>searchParams.get('search') || searchParams.get('q') || '')
  const [genre,setGenre] = useState(()=>readParam('genre'))
  const [status,setStatus] = useState(()=>readParam('status'))
  const [kind,setKind] = useState(()=>readParam('kind'))
  const [year,setYear] = useState(()=>readParam('year'))
  const [sort,setSort] = useState(()=>readParam('sort', 'relevant'))
  const [visible,setVisible] = useState(24)

  useEffect(()=>{
    setQuery(searchParams.get('search') || searchParams.get('q') || '')
    setGenre(readParam('genre'))
    setStatus(readParam('status'))
    setKind(readParam('kind'))
    setYear(readParam('year'))
    setSort(readParam('sort', 'relevant'))
    setVisible(24)
  }, [paramsKey])

  const safeItems = useMemo(()=>Array.isArray(items) ? items.filter(visibleCatalogItem) : [], [items])
  const genres = useMemo(()=>unique(safeItems.flatMap(a=>a.genres)).sort((a,b)=>a.localeCompare(b,'ru')), [safeItems])
  const years = useMemo(()=>unique(safeItems.map(a=>a.year)).sort((a,b)=>b-a), [safeItems])

  const filtered = useMemo(()=>filterAndSortAnime(safeItems, query, { genre, status, kind, year }, sort), [safeItems, query, genre, status, kind, year, sort])

  const reset = () => { setQuery(''); setGenre('all'); setStatus('all'); setKind('all'); setYear('all'); setSort('relevant'); setVisible(24) }
  const activeSearchHint = getCatalogHint(query)
  const quickQueries = ['лёгкое позитивное', 'короткое на вечер', 'онгоинг', 'романтика', 'мрачное фэнтези']

  return <>
    <section className="catalog-tools widget">
      <div className="catalog-search">
        <span>⌕</span>
        <input value={query} onChange={e=>{setQuery(e.target.value);setVisible(24)}} placeholder="Название, жанр, описание..." />
      </div>
      <div className="filter-grid">
        <label><span>Жанр</span><select value={genre} onChange={e=>{setGenre(e.target.value);setVisible(24)}}><option value="all">Все жанры</option>{genres.map(g=><option key={g} value={g}>{g}</option>)}</select></label>
        <label><span>Статус</span><select value={status} onChange={e=>{setStatus(e.target.value);setVisible(24)}}>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label><span>Тип</span><select value={kind} onChange={e=>{setKind(e.target.value);setVisible(24)}}>{Object.entries(kindLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label><span>Год</span><select value={year} onChange={e=>{setYear(e.target.value);setVisible(24)}}><option value="all">Все годы</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label>
        <label><span>Сортировка</span><select value={sort} onChange={e=>{setSort(e.target.value);setVisible(24)}}>{Object.entries(sortLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      </div>
      <div className="filter-summary"><b>{filtered.length}</b> тайтлов найдено <span>{activeSearchHint}</span><button onClick={reset}>Сбросить фильтры</button></div>
      <div className="catalog-query-chips">{quickQueries.map(x=><button type="button" key={x} onClick={()=>{setQuery(x);setVisible(24)}}>{x}</button>)}</div>
    </section>

    <section className="catalog-layout">
      <aside id="catalog-genres" className="catalog-aside widget">
        <h3>Быстрые жанры</h3>
        <div className="genre-cloud">
          {genres.slice(0,18).map(g=><button className={genre===g?'active':''} onClick={()=>{setGenre(genre===g?'all':g);setVisible(24)}} key={g}>{g}</button>)}
        </div>
        <div className="ai-note"><b>AI-подбор</b><p>Фильтры оставляем классическими, а AI помогает найти похожие тайтлы уже на странице аниме.</p><Link href="/ai">Открыть AI →</Link></div>
      </aside>
      <div className="catalog-results">
        {!filtered.length ? <div className="catalog-empty widget"><b>Ничего не нашли</b><p>Попробуй другое название, жанр, настроение или сбрось фильтры. Поиск понимает русские и английские названия, описание, студию и год.</p><button className="secondary" onClick={reset}>Сбросить фильтры</button></div> : null}
        {filtered.slice(0, visible).map(a=><Link className="catalog-card catalog-card-live" href={animeHref(a.slug)} key={a.slug} prefetch={false}>
          <div className="catalog-cover"><img loading="lazy" decoding="async" width="240" height="340" src={a.poster} alt={a.title ? `Постер аниме ${a.title}` : "Постер аниме"}/><GlobalRatingBadge slug={a.slug} score={a.rating} count={a.siteRatingCount}/></div>
          <div className="catalog-body"><b>{a.title}</b><em>{a.originalTitle}</em><p>{a.description}</p><div>{a.genres.slice(0,3).map(g=><i key={g}>{g}</i>)}</div><small>{a.year} · {a.meta} · {statusLabels[a.status] || a.status}</small></div>
          <div className="catalog-hover-preview" aria-hidden="true">
            <strong>{a.title}</strong>
            <span>{a.year} · {a.meta}</span>
            <p>{a.description}</p>
            <em>Открыть тайтл →</em>
          </div>
        </Link>)}
      {visible < filtered.length && <div className="load-more"><button className="secondary" onClick={()=>setVisible(v=>v+24)}>Показать ещё</button></div>}
      </div>
    </section>
  </>
}
