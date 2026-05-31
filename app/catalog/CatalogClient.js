'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { filterAndSortAnime, getCatalogHint } from '@/lib/searchRelevance'
import UserRatingBadge from '@/components/UserRatingBadge'

const statusLabels = { all:'Все статусы', ongoing:'Онгоинг', completed:'Завершено', released:'Фильм' }
const kindLabels = { all:'Любой тип', tv:'TV сериал', movie:'Фильм', ova:'OVA' }
const sortLabels = { relevant:'Сначала релевантные', popular:'Популярные', rating:'По рейтингу', newest:'Сначала новые', episodes:'Больше серий' }

function unique(list){ return Array.from(new Set(list)).filter(Boolean) }

export default function CatalogClient({ items }){
  const [query,setQuery] = useState('')
  const [genre,setGenre] = useState('all')
  const [status,setStatus] = useState('all')
  const [kind,setKind] = useState('all')
  const [year,setYear] = useState('all')
  const [sort,setSort] = useState('relevant')
  const [visible,setVisible] = useState(24)

  const genres = useMemo(()=>unique(items.flatMap(a=>a.genres)).sort((a,b)=>a.localeCompare(b,'ru')), [items])
  const years = useMemo(()=>unique(items.map(a=>a.year)).sort((a,b)=>b-a), [items])

  const filtered = useMemo(()=>filterAndSortAnime(items, query, { genre, status, kind, year }, sort), [items, query, genre, status, kind, year, sort])

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
      <aside className="catalog-aside widget">
        <h3>Быстрые жанры</h3>
        <div className="genre-cloud">
          {genres.slice(0,18).map(g=><button className={genre===g?'active':''} onClick={()=>{setGenre(genre===g?'all':g);setVisible(24)}} key={g}>{g}</button>)}
        </div>
        <div className="ai-note"><b>AI-подбор</b><p>Фильтры оставляем классическими, а AI помогает найти похожие тайтлы уже на странице аниме.</p><Link href="/ai">Открыть AI →</Link></div>
      </aside>
      <div className="catalog-results">
        {!filtered.length ? <div className="catalog-empty widget"><b>Ничего не нашли</b><p>Попробуй другое название, жанр, настроение или сбрось фильтры. Поиск понимает русские и английские названия, описание, студию и год.</p><button className="secondary" onClick={reset}>Сбросить фильтры</button></div> : null}
        {filtered.slice(0, visible).map(a=><Link className="catalog-card catalog-card-live" href={`/anime/${a.slug}`} key={a.slug}>
          <div className="catalog-cover"><img loading="lazy" decoding="async" src={a.poster} alt={a.title || "Аниме"}/><span>★ {a.rating}</span><UserRatingBadge slug={a.slug} compact/></div>
          <div className="catalog-body"><b>{a.title}</b><em>{a.originalTitle}</em><p>{a.description}</p><div>{a.genres.slice(0,3).map(g=><i key={g}>{g}</i>)}</div><small>{a.year} · {a.meta} · {statusLabels[a.status] || a.status}</small></div>
          <div className="catalog-hover-preview">
            <strong>{a.title}</strong>
            <span>★ {a.rating} · {a.year} · {a.meta}</span>
            <p>{a.description}</p>
            <em>Открыть тайтл →</em>
          </div>
        </Link>)}
      {visible < filtered.length && <div className="load-more"><button className="secondary" onClick={()=>setVisible(v=>v+24)}>Показать ещё</button></div>}
      </div>
    </section>
  </>
}
