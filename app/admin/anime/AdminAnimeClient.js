'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { pushToast } from '@/components/ToastCenter'

function hasCyrillic(value){
  return /[А-Яа-яЁё]/.test(String(value || ''))
}

function hasLatinOnly(value){
  const text = String(value || '').trim()
  return Boolean(text && /[A-Za-z]/.test(text) && !hasCyrillic(text))
}

function isPlaceholder(value){
  const text = String(value || '').trim().toLowerCase()
  return !text || text.includes('будет добавлено') || text.includes('описание появится') || text === '—'
}

function cleanTitle(value){
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
  missingTitle: 'Без русского',
  latinTitle: 'title_ru латиницей',
  missingDescription: 'Без описания',
  badSymbols: 'С мусором',
  ongoing: 'Онгоинги'
}

export default function AdminAnimeClient({ items = [] }){
  const [query,setQuery] = useState('')
  const [filter,setFilter] = useState('all')
  const [selected,setSelected] = useState(items[0] || null)
  const [form,setForm] = useState(toForm(items[0] || null))
  const [saving,setSaving] = useState(false)

  const stats = useMemo(()=>{
    const total = items.length
    const missingTitle = items.filter(item => !String(item.titleRu || '').trim()).length
    const latinTitle = items.filter(item => hasLatinOnly(item.titleRu)).length
    const badSymbols = items.filter(item => /[●•]{2,}/.test(`${item.titleRu || ''} ${item.title || ''}`)).length
    const ongoing = items.filter(item => item.status === 'ongoing').length
    const missingDescription = items.filter(item => isPlaceholder(item.descriptionRu || item.description)).length
    return { total, missingTitle, latinTitle, badSymbols, ongoing, missingDescription }
  }, [items])

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase()
    return items.filter(item => {
      const hay = `${item.title || ''} ${item.titleRu || ''} ${item.englishTitle || ''} ${item.originalTitle || ''} ${item.slug || ''} ${(item.genres || []).join(' ')}`.toLowerCase()
      if(q && !hay.includes(q)) return false
      if(filter === 'missingTitle') return !String(item.titleRu || '').trim()
      if(filter === 'latinTitle') return hasLatinOnly(item.titleRu)
      if(filter === 'missingDescription') return isPlaceholder(item.descriptionRu || item.description)
      if(filter === 'badSymbols') return /[●•]{2,}/.test(`${item.titleRu || ''} ${item.title || ''}`)
      if(filter === 'ongoing') return item.status === 'ongoing'
      return true
    }).slice(0,220)
  }, [items, query, filter])

  function select(item){
    setSelected(item)
    setForm(toForm(item))
  }

  function update(key, value){
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function save(){
    if(!form.slug) return
    setSaving(true)
    try{
      const res = await fetch('/api/admin/anime', {
        method:'PATCH',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(form)
      })
      const payload = await res.json()
      if(!payload.ok) throw new Error(payload.error || 'Ошибка сохранения')
      pushToast('Тайтл сохранён в Supabase', 'success')
    }catch(error){
      pushToast(error?.message || 'Не удалось сохранить', 'error')
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
    }))
    pushToast('Название очищено в форме', 'success')
  }

  function fillRuFromCurrent(){
    if(!form.titleRu && selected?.title && hasCyrillic(selected.title)){
      update('titleRu', selected.title)
      pushToast('Русское название подставлено', 'success')
    }
  }

  return <section className="admin-content-layout">
    <aside className="widget admin-panel admin-anime-left">
      <div className="admin-section-title">
        <div>
          <h2>Тайтлы</h2>
          <p>{filtered.length} из {stats.total}</p>
        </div>
        <Link href="/admin/sync">Cron</Link>
      </div>

      <div className="admin-mini-stats">
        <button onClick={()=>setFilter('all')} className={filter==='all'?'active':''}><span>Всего</span><b>{stats.total}</b></button>
        <button onClick={()=>setFilter('missingTitle')} className={filter==='missingTitle'?'active':''}><span>Без RU</span><b>{stats.missingTitle}</b></button>
        <button onClick={()=>setFilter('latinTitle')} className={filter==='latinTitle'?'active':''}><span>Латиница</span><b>{stats.latinTitle}</b></button>
        <button onClick={()=>setFilter('badSymbols')} className={filter==='badSymbols'?'active':''}><span>Мусор</span><b>{stats.badSymbols}</b></button>
      </div>

      <div className="catalog-search admin-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Найти тайтл, slug, жанр..."/></div>

      <div className="admin-filter-row">
        {Object.entries(filterLabels).map(([id,label])=><button key={id} onClick={()=>setFilter(id)} className={filter===id?'active':''}>{label}</button>)}
      </div>

      <div className="admin-list admin-anime-list">
        {filtered.map(item=><button className={selected?.slug===item.slug?'active':''} onClick={()=>select(item)} key={item.slug}>
          <img src={item.poster}/>
          <span>{item.titleRu || item.title}</span>
          <em>{item.year || '—'} · {item.status === 'ongoing' ? 'онгоинг' : item.kind || 'tv'} · ★ {item.rating}</em>
          {!item.titleRu ? <i>нет RU</i> : hasLatinOnly(item.titleRu) ? <i>латиница</i> : null}
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
          <span className={!isPlaceholder(form.descriptionRu) ? 'ok' : 'warn'}>{!isPlaceholder(form.descriptionRu) ? 'Описание есть' : 'Нужно описание'}</span>
          <span className={form.posterUrl ? 'ok' : 'warn'}>{form.posterUrl ? 'Постер есть' : 'Нет постера'}</span>
          <span>{form.status}</span>
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
          <button className="primary" onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить тайтл'}</button>
          <button className="secondary" onClick={cleanupForm}>Очистить ●●</button>
          <button className="secondary" onClick={fillRuFromCurrent}>Подставить RU</button>
          <Link className="secondary" href={`/anime/${selected.slug}`}>Открыть на сайте</Link>
          <button className="secondary" onClick={copySlug}>Копировать slug</button>
        </div>

        <p className="admin-muted">Поля сохраняются в Supabase. Для ручных правок используй “Русское название” и “Описание RU” — публичный сайт в первую очередь берёт именно их.</p>
      </> : <div className="empty-state">Выбери тайтл слева.</div>}
    </div>
  </section>
}
