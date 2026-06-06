'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { pushToast } from '@/components/ToastCenter'
import { translateGenres, makeRussianDescription, cleanPublicText } from '@/lib/ruContent'

function hasCyrillic(value){
  return /[А-Яа-яЁё]/.test(String(value || ''))
}

function hasLatinOnly(value){
  const text = String(value || '').trim()
  return Boolean(text && /[A-Za-z]/.test(text) && !hasCyrillic(text))
}

function isPlaceholder(value){
  const text = String(value || '').trim().toLowerCase()
  return !text || text.includes('будет добавлено') || text.includes('описание появится') || text === '—' || text === 'default'
}

function hasBadSymbols(value){
  return /[●•]{2,}/.test(String(value || ''))
}

function asGenreList(value){
  if(Array.isArray(value)) return value
  return String(value || '').split(',').map(x => x.trim()).filter(Boolean)
}

function hasEnglishGenre(value){
  return asGenreList(value).some(genre => {
    const text = String(genre || '').trim()
    return Boolean(text && /^[A-Za-z0-9\s()'&:/.+-]+$/.test(text))
  })
}

function normalizeGenres(value){
  return translateGenres(asGenreList(value)).join(', ')
}

function descriptionText(item){
  return cleanPublicText(item?.descriptionRu || item?.description || '')
}

function isShortDescription(value){
  const text = cleanPublicText(value)
  return !text || text.length < 140
}

function isGeneratedDescription(value){
  const text = String(value || '')
  return text.includes('подойдёт зрителям') || text.includes('атмосферу истории, развитие персонажей')
}

function needsContentWork(item){
  return isPlaceholder(item.descriptionRu || item.description)
    || isShortDescription(item.descriptionRu || item.description)
    || hasEnglishGenre(item.genres)
    || hasBadSymbols(`${item.titleRu || ''} ${item.title || ''} ${item.descriptionRu || item.description || ''}`)
}

function cleanTitle(value){
  return String(value || '')
    .replace(/[●•]{2,}/g, '')
    .replace(/\s+([:,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function cleanDescription(value){
  return String(value || '')
    .replace(/[●•]{2,}/g, '')
    .replace(/\s+([:,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function toForm(item){
  const titleRu = item?.titleRu || (hasCyrillic(item?.title) ? item.title : '')
  return {
    slug: item?.slug || '',
    titleRu,
    title: item?.englishTitle || (!hasCyrillic(item?.title) ? item?.title : '') || '',
    originalTitle: item?.originalTitle || '',
    descriptionRu: item?.descriptionRu || item?.description || '',
    description: item?.description || '',
    posterUrl: item?.poster || '',
    bannerUrl: item?.banner || '',
    year: item?.year || '',
    episodes: item?.episodes || '',
    rating: item?.score || item?.rating || '',
    status: item?.status || 'completed',
    kind: item?.kind || 'tv',
    genres: (item?.genres || []).join(', '),
    studio: item?.studio || ''
  }
}

const filterLabels = {
  all: 'Все',
  needsContent: 'Контент-проблемы',
  missingTitle: 'Без русского',
  latinTitle: 'title_ru латиницей',
  missingDescription: 'Без описания',
  shortDescription: 'Короткое описание',
  generatedDescription: 'Шаблонное описание',
  englishGenres: 'Англ. жанры',
  badSymbols: 'С мусором',
  missingPoster: 'Без постера',
  ongoing: 'Онгоинги'
}

const validFilters = new Set(Object.keys(filterLabels))

function itemHasPoster(item){
  const poster = String(item?.poster || '').trim()
  return Boolean(poster && !poster.includes('/posters/magic') && !poster.includes('/posters/placeholder'))
}

function itemMatchesFilter(item, filter){
  if(filter === 'needsContent') return needsContentWork(item)
  if(filter === 'missingTitle') return !String(item.titleRu || '').trim()
  if(filter === 'latinTitle') return hasLatinOnly(item.titleRu)
  if(filter === 'missingDescription') return isPlaceholder(item.descriptionRu || item.description)
  if(filter === 'shortDescription') return isShortDescription(item.descriptionRu || item.description)
  if(filter === 'generatedDescription') return isGeneratedDescription(item.descriptionRu || item.description)
  if(filter === 'englishGenres') return hasEnglishGenre(item.genres)
  if(filter === 'badSymbols') return hasBadSymbols(`${item.titleRu || ''} ${item.title || ''} ${item.descriptionRu || item.description || ''}`)
  if(filter === 'missingPoster') return !itemHasPoster(item)
  if(filter === 'ongoing') return item.status === 'ongoing'
  return true
}

export default function AdminAnimeClient({ items = [] }){
  const searchParams = useSearchParams()
  const initialFilter = searchParams.get('filter')
  const initialQuery = searchParams.get('q') || ''

  const [query,setQuery] = useState(initialQuery)
  const [filter,setFilter] = useState(validFilters.has(initialFilter) ? initialFilter : 'all')
  const [selected,setSelected] = useState(items[0] || null)
  const [form,setForm] = useState(toForm(items[0] || null))
  const [saving,setSaving] = useState(false)
  const [bulkRunning,setBulkRunning] = useState(false)
  const [autoNext,setAutoNext] = useState(true)
  const [dirty,setDirty] = useState(false)

  const stats = useMemo(()=>{
    const total = items.length
    const missingTitle = items.filter(item => !String(item.titleRu || '').trim()).length
    const latinTitle = items.filter(item => hasLatinOnly(item.titleRu)).length
    const badSymbols = items.filter(item => hasBadSymbols(`${item.titleRu || ''} ${item.title || ''} ${item.descriptionRu || item.description || ''}`)).length
    const ongoing = items.filter(item => item.status === 'ongoing').length
    const missingDescription = items.filter(item => isPlaceholder(item.descriptionRu || item.description)).length
    const shortDescription = items.filter(item => isShortDescription(item.descriptionRu || item.description)).length
    const generatedDescription = items.filter(item => isGeneratedDescription(item.descriptionRu || item.description)).length
    const englishGenres = items.filter(item => hasEnglishGenre(item.genres)).length
    const missingPoster = items.filter(item => !itemHasPoster(item)).length
    const needsContent = items.filter(item => needsContentWork(item)).length
    return { total, missingTitle, latinTitle, badSymbols, ongoing, missingDescription, shortDescription, generatedDescription, englishGenres, missingPoster, needsContent }
  }, [items])

  const filteredAll = useMemo(()=>{
    const q = query.trim().toLowerCase()
    return items.filter(item => {
      const hay = `${item.title || ''} ${item.titleRu || ''} ${item.englishTitle || ''} ${item.originalTitle || ''} ${item.slug || ''} ${(item.genres || []).join(' ')}`.toLowerCase()
      if(q && !hay.includes(q)) return false
      return itemMatchesFilter(item, filter)
    })
  }, [items, query, filter])

  const filtered = useMemo(()=>filteredAll.slice(0,260), [filteredAll])
  const selectedIndex = useMemo(()=>filtered.findIndex(item => item.slug === selected?.slug), [filtered, selected])
  const nextProblem = filtered[selectedIndex + 1] || filtered[0] || null

  useEffect(()=>{
    if(!selected || !filtered.some(item => item.slug === selected.slug)){
      const first = filtered[0] || items[0] || null
      setSelected(first)
      setForm(toForm(first))
      setDirty(false)
    }
  }, [filter, query, filtered, items, selected])

  function select(item, options = {}){
    if(!options.force && dirty && selected?.slug !== item?.slug){
      const ok = window.confirm('Есть несохранённые изменения. Перейти к другому тайтлу без сохранения?')
      if(!ok) return
    }
    setSelected(item)
    setForm(toForm(item))
    setDirty(false)
  }

  function update(key, value){
    setForm(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  async function save(options = {}){
    if(!form.slug) return false
    setSaving(true)
    try{
      const res = await fetch('/admin/api/anime', {
        method:'PATCH',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(form)
      })
      const payload = await res.json()
      if(!payload.ok) throw new Error(payload.error || 'Ошибка сохранения')
      pushToast('Тайтл сохранён в Supabase', 'success')
      setDirty(false)
      if(options.next && nextProblem){
        select(nextProblem, { force:true })
      }
      return true
    }catch(error){
      pushToast(error?.message || 'Не удалось сохранить', 'error')
      return false
    }finally{
      setSaving(false)
    }
  }

  function copySlug(){
    if(!selected) return
    navigator.clipboard?.writeText(selected.slug)
    pushToast('Slug скопирован', 'success')
  }

  function cleanupForm(){
    setForm(prev => ({
      ...prev,
      titleRu: cleanTitle(prev.titleRu),
      title: cleanTitle(prev.title),
      originalTitle: cleanTitle(prev.originalTitle),
      descriptionRu: cleanDescription(prev.descriptionRu),
      description: cleanDescription(prev.description),
    }))
    setDirty(true)
    pushToast('Название и описание очищены в форме', 'success')
  }

  function translateGenresInForm(){
    const nextGenres = normalizeGenres(form.genres)
    update('genres', nextGenres)
    pushToast('Жанры переведены в форме', 'success')
  }

  function generateDescriptionInForm(){
    const genres = asGenreList(form.genres)
    const descriptionRu = makeRussianDescription({
      title_ru: form.titleRu || form.title || selected?.titleRu || selected?.title,
      title: form.title || selected?.englishTitle || selected?.title,
      original_title: form.originalTitle || selected?.originalTitle,
      genres,
      kind: form.kind,
      status: form.status,
      year: form.year,
      episodes: form.episodes,
      studio: form.studio,
      rating: form.rating
    })
    update('descriptionRu', descriptionRu)
    pushToast('Описание RU сгенерировано', 'success')
  }

  function cleanupContentForm(){
    const translatedGenres = normalizeGenres(form.genres)
    const currentDescription = cleanDescription(form.descriptionRu)
    const shouldGenerate = isPlaceholder(currentDescription) || isShortDescription(currentDescription)
    const generatedDescription = shouldGenerate ? makeRussianDescription({
      title_ru: cleanTitle(form.titleRu || selected?.titleRu || selected?.title),
      title: cleanTitle(form.title || selected?.englishTitle || selected?.title),
      original_title: cleanTitle(form.originalTitle || selected?.originalTitle),
      genres: asGenreList(translatedGenres),
      kind: form.kind,
      status: form.status,
      year: form.year,
      episodes: form.episodes,
      studio: form.studio,
      rating: form.rating
    }) : currentDescription

    setForm(prev => ({
      ...prev,
      titleRu: cleanTitle(prev.titleRu),
      title: cleanTitle(prev.title),
      originalTitle: cleanTitle(prev.originalTitle),
      genres: translatedGenres,
      descriptionRu: generatedDescription,
      description: cleanDescription(prev.description),
    }))
    setDirty(true)
    pushToast('Контент в форме приведён в порядок', 'success')
  }

  function fillRuFromCurrent(){
    if(!form.titleRu && selected?.title && hasCyrillic(selected.title)){
      update('titleRu', selected.title)
      pushToast('Русское название подставлено', 'success')
      return
    }
    if(hasLatinOnly(form.titleRu) && selected?.title && hasCyrillic(selected.title)){
      update('titleRu', selected.title)
      pushToast('Латинский title_ru заменён русским из карточки', 'success')
    }
  }

  async function saveAndNext(){
    const ok = await save({ next:false })
    if(ok && autoNext && nextProblem) select(nextProblem, { force:true })
  }

  function goNext(){
    if(nextProblem) select(nextProblem, { force:true })
  }

  async function bulkCleanupVisible(){
    const targets = filteredAll.filter(item => itemMatchesFilter(item, 'badSymbols')).slice(0,120)
    if(!targets.length){
      pushToast('В текущей выборке нет мусорных символов', 'success')
      return
    }
    const ok = window.confirm(`Очистить ●● в ${targets.length} тайтлах текущей выборки? Это сохранит изменения в Supabase.`)
    if(!ok) return

    setBulkRunning(true)
    let done = 0
    let failed = 0
    try{
      for(const item of targets){
        const payload = {
          slug: item.slug,
          titleRu: cleanTitle(item.titleRu || item.title),
          title: cleanTitle(item.englishTitle || item.title),
          originalTitle: cleanTitle(item.originalTitle),
          descriptionRu: cleanDescription(item.descriptionRu || item.description),
          description: cleanDescription(item.description),
        }
        const res = await fetch('/admin/api/anime', {
          method:'PATCH',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json().catch(()=>null)
        if(res.ok && data?.ok) done += 1
        else failed += 1
      }
      pushToast(`Очистка завершена: ${done} сохранено${failed ? `, ошибок: ${failed}` : ''}`, failed ? 'error' : 'success')
    }catch(error){
      pushToast(error?.message || 'Ошибка массовой очистки', 'error')
    }finally{
      setBulkRunning(false)
    }
  }

  async function bulkContentVisible(){
    const targets = filteredAll.filter(item => needsContentWork(item)).slice(0,80)
    if(!targets.length){
      pushToast('В текущей выборке нет явных проблем с контентом', 'success')
      return
    }
    const ok = window.confirm(`Русифицировать жанры и заполнить короткие/пустые описания в ${targets.length} тайтлах текущей выборки? Хорошие описания не затираются.`)
    if(!ok) return

    setBulkRunning(true)
    let done = 0
    let failed = 0
    try{
      for(const item of targets){
        const genres = translateGenres(item.genres || [])
        const currentDescription = descriptionText(item)
        const shouldGenerate = isPlaceholder(currentDescription) || isShortDescription(currentDescription)
        const payload = {
          slug: item.slug,
          titleRu: cleanTitle(item.titleRu || item.title),
          title: cleanTitle(item.englishTitle || item.title),
          originalTitle: cleanTitle(item.originalTitle),
          genres: genres.join(', '),
          descriptionRu: shouldGenerate ? makeRussianDescription({
            ...item,
            title_ru: item.titleRu || item.title,
            title: item.englishTitle || item.title,
            original_title: item.originalTitle,
            genres
          }) : cleanDescription(currentDescription),
          description: cleanDescription(item.description),
        }
        const res = await fetch('/admin/api/anime', {
          method:'PATCH',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json().catch(()=>null)
        if(res.ok && data?.ok) done += 1
        else failed += 1
      }
      pushToast(`Контент обработан: ${done} сохранено${failed ? `, ошибок: ${failed}` : ''}`, failed ? 'error' : 'success')
    }catch(error){
      pushToast(error?.message || 'Ошибка массовой обработки контента', 'error')
    }finally{
      setBulkRunning(false)
    }
  }

  const visibleNotice = filteredAll.length > filtered.length
    ? `Показано ${filtered.length} из ${filteredAll.length}. Уточни поиск, чтобы список был легче.`
    : `${filtered.length} в текущей выборке`

  return <section className="admin-content-layout">
    <aside className="widget admin-panel admin-anime-left">
      <div className="admin-section-title">
        <div>
          <h2>Тайтлы</h2>
          <p>{visibleNotice}</p>
        </div>
        <Link href="/admin/sync">Cron</Link>
      </div>

      <div className="admin-mini-stats admin-mini-stats-six admin-mini-stats-content">
        <button onClick={()=>setFilter('all')} className={filter==='all'?'active':''}><span>Всего</span><b>{stats.total}</b></button>
        <button onClick={()=>setFilter('needsContent')} className={filter==='needsContent'?'active':''}><span>Контент</span><b>{stats.needsContent}</b></button>
        <button onClick={()=>setFilter('missingTitle')} className={filter==='missingTitle'?'active':''}><span>Без RU</span><b>{stats.missingTitle}</b></button>
        <button onClick={()=>setFilter('englishGenres')} className={filter==='englishGenres'?'active':''}><span>Англ. жанры</span><b>{stats.englishGenres}</b></button>
        <button onClick={()=>setFilter('shortDescription')} className={filter==='shortDescription'?'active':''}><span>Короткие</span><b>{stats.shortDescription}</b></button>
        <button onClick={()=>setFilter('badSymbols')} className={filter==='badSymbols'?'active':''}><span>Мусор</span><b>{stats.badSymbols}</b></button>
      </div>

      <div className="catalog-search admin-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Найти тайтл, slug, жанр..."/></div>

      <div className="admin-filter-row">
        {Object.entries(filterLabels).map(([id,label])=><button key={id} onClick={()=>setFilter(id)} className={filter===id?'active':''}>{label}</button>)}
      </div>

      <div className="admin-bulk-tools admin-bulk-tools-wrap">
        <button onClick={bulkCleanupVisible} disabled={bulkRunning || !stats.badSymbols}>{bulkRunning ? 'Очищаю…' : 'Очистить ●● в выборке'}</button>
        <button onClick={bulkContentVisible} disabled={bulkRunning || !stats.needsContent}>{bulkRunning ? 'Обработка…' : 'Жанры + описания в выборке'}</button>
        <label><input type="checkbox" checked={autoNext} onChange={e=>setAutoNext(e.target.checked)}/> после сохранения — следующий</label>
      </div>

      <div className="admin-list admin-anime-list">
        {filtered.map(item=><button className={selected?.slug===item.slug?'active':''} onClick={()=>select(item)} key={item.slug}>
          <img src={item.poster}/>
          <span>{item.titleRu || item.title}</span>
          <em>{item.year || '—'} · {item.status === 'ongoing' ? 'онгоинг' : item.kind || 'tv'} · ★ {item.rating}</em>
          {!item.titleRu ? <i>нет RU</i> : hasLatinOnly(item.titleRu) ? <i>латиница</i> : hasBadSymbols(`${item.titleRu} ${item.title}`) ? <i>мусор</i> : null}
        </button>)}
      </div>
    </aside>

    <div className="widget admin-edit-preview admin-anime-editor">
      {selected ? <>
        <div className="admin-current admin-current-wide">
          <img src={form.posterUrl || selected.poster}/>
          <div>
            <b>{form.titleRu || form.title || selected.title}</b>
            <span>{form.originalTitle || form.title || selected.originalTitle}</span>
            <small>{selected.slug}</small>
          </div>
        </div>

        <div className="admin-quality-bar">
          <span className={form.titleRu && hasCyrillic(form.titleRu) ? 'ok' : 'warn'}>{form.titleRu && hasCyrillic(form.titleRu) ? 'RU название есть' : 'Нужно RU название'}</span>
          <span className={!hasLatinOnly(form.titleRu) ? 'ok' : 'warn'}>{!hasLatinOnly(form.titleRu) ? 'title_ru не латиницей' : 'title_ru латиницей'}</span>
          <span className={!hasBadSymbols(`${form.titleRu} ${form.descriptionRu}`) ? 'ok' : 'warn'}>{!hasBadSymbols(`${form.titleRu} ${form.descriptionRu}`) ? 'Без мусора' : 'Есть ●●'}</span>
          <span className={!hasEnglishGenre(form.genres) ? 'ok' : 'warn'}>{!hasEnglishGenre(form.genres) ? 'Жанры RU' : 'Есть англ. жанры'}</span>
          <span className={!isPlaceholder(form.descriptionRu) && !isShortDescription(form.descriptionRu) ? 'ok' : 'warn'}>{!isPlaceholder(form.descriptionRu) && !isShortDescription(form.descriptionRu) ? 'Описание норм' : 'Нужно описание'}</span>
          <span className={form.posterUrl ? 'ok' : 'warn'}>{form.posterUrl ? 'Постер есть' : 'Нет постера'}</span>
          {dirty ? <span className="warn">Есть несохранённые правки</span> : <span className="ok">Сохранено</span>}
        </div>

        <div className="admin-editor-helper">
          <b>Быстрая чистка данных</b>
          <p>Работай по фильтрам слева: “Контент-проблемы”, “Англ. жанры”, “Короткое описание”, “С мусором”. После сохранения можно автоматически переходить к следующему тайтлу.</p>
        </div>

        <div className="admin-preview-grid editable-admin-grid admin-anime-form-grid">
          <label className="important"><span>Русское название</span><input value={form.titleRu} onChange={e=>update('titleRu', e.target.value)} placeholder="Например: Магическая битва"/></label>
          <label><span>Название MAL / английское</span><input value={form.title} onChange={e=>update('title', e.target.value)} placeholder="English title"/></label>
          <label><span>Оригинальное название</span><input value={form.originalTitle} onChange={e=>update('originalTitle', e.target.value)}/></label>
          <label><span>Slug</span><input value={form.slug} readOnly/></label>
          <label><span>Студия</span><input value={form.studio} onChange={e=>update('studio', e.target.value)}/></label>
          <label><span>Год</span><input value={form.year} onChange={e=>update('year', e.target.value)}/></label>
          <label><span>Эпизоды</span><input value={form.episodes} onChange={e=>update('episodes', e.target.value)}/></label>
          <label><span>Рейтинг</span><input value={form.rating} onChange={e=>update('rating', e.target.value)}/></label>
          <label><span>Статус</span><select value={form.status} onChange={e=>update('status', e.target.value)}><option value="ongoing">Онгоинг</option><option value="completed">Завершён</option><option value="released">Фильм</option><option value="anons">Анонс</option></select></label>
          <label><span>Тип</span><select value={form.kind} onChange={e=>update('kind', e.target.value)}><option value="tv">TV</option><option value="movie">Фильм</option><option value="ova">OVA</option><option value="ona">ONA</option></select></label>
          <label className="wide"><span>Постер URL</span><input value={form.posterUrl} onChange={e=>update('posterUrl', e.target.value)}/></label>
          <label className="wide"><span>Баннер URL</span><input value={form.bannerUrl} onChange={e=>update('bannerUrl', e.target.value)}/></label>
          <label className="wide"><span>Жанры через запятую</span><input value={form.genres} onChange={e=>update('genres', e.target.value)} placeholder="Экшен, Фэнтези, Драма"/></label>
          <label className="wide"><span>Описание RU</span><textarea value={form.descriptionRu} onChange={e=>update('descriptionRu', e.target.value)} placeholder="Описание для сайта на русском"/></label>
          <label className="wide"><span>Описание original/fallback</span><textarea value={form.description} onChange={e=>update('description', e.target.value)} placeholder="Можно оставить пустым, если RU описание заполнено"/></label>
        </div>

        <div className="admin-actions-row admin-sticky-actions">
          <button className="primary" onClick={()=>save()} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить тайтл'}</button>
          <button className="primary soft" onClick={saveAndNext} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить и дальше'}</button>
          <button className="secondary" onClick={cleanupForm}>Очистить ●●</button>
          <button className="secondary" onClick={translateGenresInForm}>Перевести жанры</button>
          <button className="secondary" onClick={generateDescriptionInForm}>Описание RU</button>
          <button className="secondary" onClick={cleanupContentForm}>Контент fix</button>
          <button className="secondary" onClick={fillRuFromCurrent}>Подставить RU</button>
          <button className="secondary" onClick={goNext} disabled={!nextProblem}>Следующий</button>
          <Link className="secondary" href={`/anime/${selected.slug}`}>Открыть на сайте</Link>
          <button className="secondary" onClick={copySlug}>Копировать slug</button>
        </div>

        <p className="admin-muted">Поля сохраняются в Supabase. Для ручных правок используй “Русское название” и “Описание RU” — публичный сайт в первую очередь берёт именно их.</p>
      </> : <div className="empty-state">Выбери тайтл слева.</div>}
    </div>
  </section>
}
