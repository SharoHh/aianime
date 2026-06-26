'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { adminFetch, openAdminWithSecret } from '../adminClient'

const FILTERS = [
  ['all','Все'],
  ['restricted','Закрытые в РФ'],
  ['needs_work','Проблемные'],
  ['missing_ru','Без RU'],
  ['missing_poster','Без постера'],
  ['bad_poster','Плохой постер'],
  ['missing_description','Без описания'],
  ['short_description','Короткие'],
  ['missing_genres','Без жанров'],
  ['english_genres','Англ. жанры'],
  ['missing_player','Без плеера'],
  ['suspicious_player','Подозр. плеер'],
  ['ready','Готовые'],
]

const ISSUE_LABELS = {
  restricted:'Закрыт в РФ',   missing_ru:'Без RU', latin_ru:'RU латиницей', missing_poster:'Без постера', bad_poster:'Плохой постер', bad_banner:'Плохой баннер', missing_description:'Без описания', short_description:'Короткое', missing_genres:'Без жанров', english_genres:'Англ. жанры', bad_symbols:'Мусор', missing_player:'Без плеера', suspicious_player:'Подозр. плеер'
}

function css(){ return <style>{`
.admin-v244-page{min-height:100vh;background:#f6f4ef;color:#201c3a;font-family:Manrope,system-ui,sans-serif;padding:22px}.anime-admin{max-width:1500px;margin:0 auto}.aa-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:16px}.aa-top h1{font-size:36px;line-height:1;margin:6px 0 8px;font-weight:900;letter-spacing:-.05em}.aa-top p{margin:0;color:#746e86}.aa-nav{display:flex;gap:8px;flex-wrap:wrap}.aa-btn,.aa-nav a{border:1px solid rgba(32,28,58,.14);background:white;color:#201c3a;border-radius:14px;padding:10px 13px;text-decoration:none;font-weight:850;cursor:pointer}.aa-btn.primary{background:#201c3a;color:white}.aa-btn:disabled{opacity:.55;cursor:not-allowed}.aa-grid{display:grid;grid-template-columns:420px minmax(0,1fr);gap:14px}.aa-panel{background:white;border:1px solid rgba(32,28,58,.1);border-radius:24px;padding:16px;box-shadow:0 18px 40px rgba(32,28,58,.07)}.aa-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}.aa-stat{border:1px solid rgba(32,28,58,.09);background:#fbfaf7;border-radius:16px;padding:10px;cursor:pointer;text-align:left;color:#201c3a}.aa-stat span{display:block;font-size:11px;color:#746e86;font-weight:800}.aa-stat b{font-size:22px}.aa-tools{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.aa-input,.aa-select,.aa-textarea{border:1px solid rgba(32,28,58,.15);border-radius:14px;background:#fff;color:#201c3a;padding:10px 12px;font:inherit}.aa-input{min-width:0;flex:1}.aa-list{display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 360px);overflow:auto;padding-right:4px}.aa-item{border:1px solid rgba(32,28,58,.1);background:#fbfaf7;border-radius:17px;padding:9px;display:grid;grid-template-columns:42px 1fr;gap:10px;text-align:left;color:#201c3a;cursor:pointer}.aa-item.active{outline:2px solid #201c3a;background:white}.aa-item img{width:42px;height:58px;border-radius:10px;object-fit:cover;background:#eee}.aa-item b{display:block;font-size:13px;line-height:1.2}.aa-item small{display:block;color:#746e86;margin-top:3px;font-size:11px}.aa-badges{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}.aa-badge{display:inline-flex;border-radius:999px;background:#eeeaf7;color:#201c3a;font-size:10px;font-weight:850;padding:4px 7px}.aa-badge.bad{background:#ffe0e4;color:#8b1d31}.aa-badge.warn{background:#fff2c7;color:#6a4a00}.aa-editor-head{display:grid;grid-template-columns:92px 1fr;gap:14px;align-items:start;margin-bottom:14px}.aa-editor-head img{width:92px;height:128px;border-radius:18px;object-fit:cover;background:#eee}.aa-editor-head h2{margin:0 0 6px;font-size:25px;line-height:1.08}.aa-version{display:inline-flex;margin-top:8px;padding:5px 8px;border-radius:999px;background:#201c3a;color:#fff;font-size:10px;font-weight:900}.aa-restriction-card{grid-column:1/-1;border-radius:20px;padding:16px;border:1px solid rgba(32,28,58,.12);display:grid;gap:12px}.aa-restriction-card.open{background:#f3fbf5;border-color:rgba(35,96,51,.22)}.aa-restriction-card.blocked{background:#fff0f3;border-color:rgba(139,29,49,.28)}.aa-restriction-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.aa-restriction-title{font-size:18px;font-weight:950;margin:0}.aa-restriction-state{font-size:13px;font-weight:900}.aa-restriction-state.open{color:#236033}.aa-restriction-state.blocked{color:#8b1d31}.aa-restriction-actions{display:flex;gap:8px;flex-wrap:wrap}.aa-restriction-fields{display:grid;grid-template-columns:2fr 1fr 100px;gap:8px}.aa-restriction-fields input,.aa-restriction-fields textarea{border:1px solid rgba(32,28,58,.15);border-radius:14px;background:#fff;color:#201c3a;padding:10px 12px;font:inherit}.aa-restriction-fields textarea{min-height:78px;resize:vertical}.aa-restriction-fields label{display:flex;flex-direction:column;gap:6px}.aa-restriction-fields span{font-size:11px;color:#746e86;font-weight:850}@media(max-width:900px){.aa-restriction-fields{grid-template-columns:1fr}}.aa-editor-head p{margin:2px 0;color:#746e86;font-size:13px}.aa-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.aa-field{display:flex;flex-direction:column;gap:6px}.aa-field span{font-size:12px;color:#746e86;font-weight:850}.aa-field.wide{grid-column:1/-1}.aa-field input,.aa-field select,.aa-field textarea{border:1px solid rgba(32,28,58,.15);border-radius:14px;background:#fff;color:#201c3a;padding:11px 12px;font:inherit}.aa-field textarea{min-height:116px;resize:vertical}.aa-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;position:sticky;bottom:12px;background:rgba(255,255,255,.86);backdrop-filter:blur(10px);padding:10px;border-radius:18px;border:1px solid rgba(32,28,58,.09)}.aa-log{white-space:pre-wrap;background:#19162a;color:white;border-radius:16px;padding:12px;font-size:12px;line-height:1.45;max-height:180px;overflow:auto;margin-top:12px}.aa-empty{padding:32px;text-align:center;color:#746e86}.aa-danger{color:#8b1d31}.aa-ok{color:#236033}@media(max-width:980px){.admin-v244-page{padding:14px}.aa-grid{grid-template-columns:1fr}.aa-list{max-height:420px}.aa-form{grid-template-columns:1fr}.aa-top{display:block}.aa-nav{margin-top:12px}}
`}</style> }

function issueTone(issue){
  if(['restricted','missing_poster','bad_poster','bad_banner','missing_player'].includes(issue)) return 'bad'
  if(['missing_ru','missing_description','short_description','missing_genres','english_genres','suspicious_player','latin_ru','bad_symbols'].includes(issue)) return 'warn'
  return ''
}

function toForm(item){
  return {
    id:item?.id || '', slug:item?.slug || '', titleRu:item?.titleRu || '', title:item?.title || '', originalTitle:item?.originalTitle || '', otherTitle:item?.otherTitle || '', descriptionRu:item?.descriptionRu || '', description:item?.description || '', posterUrl:item?.posterUrl || '', bannerUrl:item?.bannerUrl || '', genres:Array.isArray(item?.genres) ? item.genres.join(', ') : '', year:item?.year || '', status:item?.status || '', kind:item?.kind || '', episodes:item?.episodes || '', rating:item?.rating || '', studio:item?.studio || '', restricted:Boolean(item?.restricted), restrictionMessage:item?.restriction?.message || 'Этот тайтл недоступен для просмотра на территории Российской Федерации.', restrictionReason:item?.restriction?.reason || '', restrictionRegion:item?.restriction?.region || 'RU'
  }
}

export default function AdminAnimeClient(){
  const [filter,setFilter] = useState('all')
  const [query,setQuery] = useState('')
  const [items,setItems] = useState([])
  const [stats,setStats] = useState({})
  const [selected,setSelected] = useState(null)
  const [form,setForm] = useState(toForm(null))
  const [loading,setLoading] = useState(false)
  const [saving,setSaving] = useState(false)
  const [log,setLog] = useState('')

  function initFromUrl(){
    if(typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const f = params.get('filter')
    const q = params.get('q')
    if(f) setFilter(f)
    if(q) setQuery(q)
  }

  async function load(next = {}){
    setLoading(true)
    const f = next.filter ?? filter
    const q = next.query ?? query
    try{
      const params = new URLSearchParams({ filter:f, q, limit:'220' })
      const data = await adminFetch(`/admin/api/anime?${params.toString()}`)
      setItems(data.items || [])
      setStats(data.stats || {})
      const current = data.items?.find(item => item.id === selected?.id) || data.items?.[0] || null
      setSelected(current)
      setForm(toForm(current))
      setLog(`Загружено: ${data.items?.length || 0} из ${data.total || 0}. Фильтр: ${f}`)
    }catch(error){
      setLog(error?.message || 'Ошибка загрузки')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ initFromUrl() }, [])
  useEffect(()=>{ load() }, [filter])

  function select(item){
    setSelected(item)
    setForm(toForm(item))
  }

  function update(key,value){
    setForm(prev => ({ ...prev, [key]:value }))
  }

  async function save(patch = {}){
    if(!form.slug && !form.id) return
    setSaving(true)
    try{
      const data = await adminFetch('/admin/api/anime', { method:'PATCH', body:JSON.stringify({ ...form, ...patch }) })
      setSelected(data.item)
      setForm(toForm(data.item))
      setLog(`Сохранено: ${data.item?.slug}`)
      await load()
    }catch(error){
      setLog(error?.message || 'Ошибка сохранения')
    }finally{
      setSaving(false)
    }
  }

  function applyRuCandidate(){
    if(!selected?.ruCandidate){
      setLog('Для этого тайтла нет русского кандидата в raw/Kodik.')
      return
    }
    update('titleRu', selected.ruCandidate)
    setLog(`Подставил RU в форму: ${selected.ruCandidate}`)
  }

  function cleanForm(){
    const clean = (v) => String(v || '').replace(/[●•]{2,}/g, '').replace(/\s+([:,.!?])/g, '$1').replace(/\s{2,}/g, ' ').trim()
    setForm(prev => ({ ...prev, titleRu:clean(prev.titleRu), title:clean(prev.title), originalTitle:clean(prev.originalTitle), descriptionRu:clean(prev.descriptionRu), description:clean(prev.description) }))
  }

  const statButtons = [
    ['total','Всего','all'], ['needs_work','Проблем','needs_work'], ['missing_ru','Без RU','missing_ru'], ['missing_poster','Без постера','missing_poster'], ['bad_poster','Плохой постер','bad_poster'], ['missing_player','Без плеера','missing_player'], ['restricted','Закрыто','restricted']
  ]

  return <div className="anime-admin">
    {css()}
    <header className="aa-top">
      <div><Link href={openAdminWithSecret('/admin')}>← Админка</Link><h1>Менеджер тайтлов</h1><p>Один рабочий экран вместо пачки дублей. Фильтр → тайтл → правка → сохранить.</p><span className="aa-version">Админка v247</span></div>
      <nav className="aa-nav"><Link href={openAdminWithSecret('/admin/tasks')}>Задачи</Link><Link href={openAdminWithSecret('/admin/import')}>Импорт</Link><Link href="/catalog">Каталог</Link><button className="aa-btn" onClick={()=>load()} disabled={loading}>{loading?'Гружу…':'Обновить'}</button></nav>
    </header>
    <section className="aa-grid">
      <aside className="aa-panel">
        <div className="aa-stats">{statButtons.map(([key,label,f]) => <button key={key} className="aa-stat" onClick={()=>setFilter(f)}><span>{label}</span><b>{stats[key] ?? 0}</b></button>)}</div>
        <div className="aa-tools"><input className="aa-input" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') load({ query }) }} placeholder="Поиск: название / slug / жанр"/><button className="aa-btn" onClick={()=>load({ query })}>Найти</button></div>
        <div className="aa-tools">{FILTERS.map(([id,label]) => <button key={id} className={`aa-btn ${filter===id?'primary':''}`} onClick={()=>setFilter(id)}>{label}</button>)}</div>
        <div className="aa-list">{items.map(item => <button key={item.id || item.slug} className={`aa-item ${selected?.id===item.id?'active':''}`} onClick={()=>select(item)}><img src={item.posterUrl || '/posters/placeholder.svg'} alt=""/><div><b>{item.titleRu || item.title || item.slug}</b><small>{item.slug} · {item.year || '—'} · {item.kind || '—'} · {item.episodes || 0} эп.</small><div className="aa-badges">{(item.issues || []).slice(0,4).map(issue => <span key={issue} className={`aa-badge ${issueTone(issue)}`}>{ISSUE_LABELS[issue] || issue}</span>)}</div></div></button>)}</div>
      </aside>
      <section className="aa-panel">
        {selected ? <>
          <div className="aa-editor-head"><img src={form.posterUrl || selected.posterUrl || '/posters/placeholder.svg'} alt=""/><div><h2>{form.titleRu || form.title || selected.slug}</h2><p>{selected.slug}</p><p>{selected.hasKodik ? <span className="aa-ok">Kodik есть</span> : <span className="aa-danger">Kodik не найден</span>} · {selected.episodes || 0} эп. · {selected.status || 'status?'}</p><div className="aa-badges">{(selected.issues || []).map(issue => <span key={issue} className={`aa-badge ${issueTone(issue)}`}>{ISSUE_LABELS[issue] || issue}</span>)}</div></div></div>
          <div className={`aa-restriction-card ${form.restricted ? 'blocked' : 'open'}`}>
            <div className="aa-restriction-head">
              <div><p className="aa-restriction-title">Доступ на территории РФ</p><div className={`aa-restriction-state ${form.restricted ? 'blocked' : 'open'}`}>{form.restricted ? 'Сейчас тайтл закрыт в РФ' : 'Сейчас тайтл доступен'}</div></div>
              <div className="aa-restriction-actions"><button className="aa-btn" style={{background:'#8b1d31',color:'#fff'}} onClick={()=>save({ restricted:true })} disabled={saving}>Закрыть в РФ</button><button className="aa-btn" style={{background:'#236033',color:'#fff'}} onClick={()=>save({ restricted:false })} disabled={saving}>Открыть доступ</button></div>
            </div>
            <div className="aa-restriction-fields">
              <label><span>Текст на закрытой странице</span><textarea value={form.restrictionMessage} onChange={e=>update('restrictionMessage', e.target.value)} /></label>
              <label><span>Причина / номер обращения</span><input value={form.restrictionReason} onChange={e=>update('restrictionReason', e.target.value)} placeholder="Например: уведомление РКН" /></label>
              <label><span>Регион</span><input value={form.restrictionRegion} onChange={e=>update('restrictionRegion', e.target.value.toUpperCase())} placeholder="RU" /></label>
            </div>
          </div>
          <div className="aa-form">
            <label className="aa-field"><span>Русское название</span><input value={form.titleRu} onChange={e=>update('titleRu', e.target.value)} /></label>
            <label className="aa-field"><span>English/MAL title</span><input value={form.title} onChange={e=>update('title', e.target.value)} /></label>
            <label className="aa-field"><span>Оригинальное название</span><input value={form.originalTitle} onChange={e=>update('originalTitle', e.target.value)} /></label>
            <label className="aa-field"><span>Other title</span><input value={form.otherTitle} onChange={e=>update('otherTitle', e.target.value)} /></label>
            <label className="aa-field"><span>Год</span><input value={form.year} onChange={e=>update('year', e.target.value)} /></label>
            <label className="aa-field"><span>Эпизоды</span><input value={form.episodes} onChange={e=>update('episodes', e.target.value)} /></label>
            <label className="aa-field"><span>Статус</span><input value={form.status} onChange={e=>update('status', e.target.value)} /></label>
            <label className="aa-field"><span>Тип</span><input value={form.kind} onChange={e=>update('kind', e.target.value)} /></label>
            <label className="aa-field wide"><span>Постер URL</span><input value={form.posterUrl} onChange={e=>update('posterUrl', e.target.value)} /></label>
            <label className="aa-field wide"><span>Баннер URL</span><input value={form.bannerUrl} onChange={e=>update('bannerUrl', e.target.value)} /></label>
            <label className="aa-field wide"><span>Жанры через запятую</span><input value={form.genres} onChange={e=>update('genres', e.target.value)} /></label>
            <label className="aa-field wide"><span>Описание RU</span><textarea value={form.descriptionRu} onChange={e=>update('descriptionRu', e.target.value)} /></label>
            <label className="aa-field wide"><span>Описание fallback</span><textarea value={form.description} onChange={e=>update('description', e.target.value)} /></label>
          </div>
          <div className="aa-actions"><button className="aa-btn primary" onClick={()=>save()} disabled={saving}>{saving?'Сохраняю…':'Сохранить'}</button><button className="aa-btn" style={{background:'#8b1d31',color:'#fff'}} onClick={()=>save({ restricted:true })} disabled={saving}>Закрыть в РФ</button><button className="aa-btn" style={{background:'#236033',color:'#fff'}} onClick={()=>save({ restricted:false })} disabled={saving}>Открыть доступ</button><button className="aa-btn" onClick={applyRuCandidate}>Подставить RU candidate</button><button className="aa-btn" onClick={cleanForm}>Очистить мусор в форме</button><button className="aa-btn" onClick={()=>navigator.clipboard?.writeText(selected.slug)}>Копировать slug</button><Link className="aa-btn" href={`/anime/${selected.slug}`}>Открыть на сайте</Link></div>
          <div className="aa-log">{log}</div>
        </> : <div className="aa-empty">Выбери тайтл слева.</div>}
      </section>
    </section>
  </div>
}
