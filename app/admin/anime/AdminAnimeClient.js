'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { pushToast } from '@/components/ToastCenter'

function toForm(item){
  return {
    slug: item?.slug || '',
    title: item?.title || '',
    originalTitle: item?.originalTitle || '',
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

export default function AdminAnimeClient({ items = [] }){
  const [query,setQuery] = useState('')
  const [selected,setSelected] = useState(items[0] || null)
  const [form,setForm] = useState(toForm(items[0] || null))
  const [saving,setSaving] = useState(false)

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase()
    if(!q) return items.slice(0,160)
    return items.filter(item => `${item.title} ${item.originalTitle} ${item.slug}`.toLowerCase().includes(q)).slice(0,160)
  }, [items, query])

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
      pushToast('Аниме обновлено', 'success')
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

  return <section className="admin-grid">
    <div className="widget admin-panel">
      <div className="catalog-search admin-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Найти тайтл..."/></div>
      <div className="admin-list">
        {filtered.map(item=><button className={selected?.slug===item.slug?'active':''} onClick={()=>select(item)} key={item.slug}>
          <img src={item.poster}/>
          <span>{item.title}</span>
          <em>{item.year} · ★ {item.rating}</em>
        </button>)}
      </div>
    </div>

    <div className="widget admin-edit-preview">
      {selected ? <>
        <div className="admin-current">
          <img src={form.posterUrl || selected.poster}/>
          <div><b>{form.title || selected.title}</b><span>{form.originalTitle || selected.originalTitle}</span></div>
        </div>

        <div className="admin-preview-grid editable-admin-grid">
          <label><span>Название</span><input value={form.title} onChange={e=>update('title', e.target.value)}/></label>
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
          <label className="wide"><span>Жанры через запятую</span><input value={form.genres} onChange={e=>update('genres', e.target.value)}/></label>
          <label className="wide"><span>Описание</span><textarea value={form.description} onChange={e=>update('description', e.target.value)}/></label>
        </div>

        <div className="admin-actions-row">
          <button className="primary" onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
          <Link className="secondary" href={`/anime/${selected.slug}`}>Открыть</Link>
          <Link className="secondary" href={`/anime/${selected.slug}#player`}>Страница просмотра</Link>
          <button className="secondary" onClick={copySlug}>Копировать slug</button>
        </div>
        <p className="admin-muted">Изменения сохраняются в Supabase. Если Supabase не настроен, появится уведомление с ошибкой.</p>
      </> : <div className="empty-state">Выбери тайтл слева.</div>}
    </div>
  </section>
}
