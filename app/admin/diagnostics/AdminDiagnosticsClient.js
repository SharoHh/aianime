'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { pushToast } from '@/components/ToastCenter'

const jobs = [
  { id:'sync', title:'Jikan / MAL', text:'Обновить каталог из Jikan. Не трогает дизайн сайта.', params:{ limit:25 } },
  { id:'kodik', title:'Kodik metadata', text:'Русские названия, качество, озвучки, Kodik-ссылки.', params:{ limit:30, all:1 } },
  { id:'players', title:'Плееры', text:'Сохранить Kodik iframe в anime_episodes.', params:{ limit:30 } },
  { id:'schedule', title:'Расписание', text:'Реальные эфиры текущей недели из Jikan schedules.', params:{ limit:25, pages:2 } },
  { id:'titles', title:'Русские названия', text:'Заполнить только пустые title_ru. Без force, ручные правки не затирает.', params:{ limit:80 } },
  { id:'russify', title:'Описание и жанры', text:'Русификация description_ru/genres, если endpoint доступен.', params:{ limit:80 } },
]

function summarize(payload){
  const data = payload?.payload || payload
  if(!data || typeof data !== 'object') return 'Ответ получен'
  const parts = []
  for(const key of ['synced','checked','matched','updated','saved','scheduleUpdated','storedLinks','resolved','skipped','errors']){
    const value = data[key]
    if(value === undefined) continue
    if(Array.isArray(value)) parts.push(`${key}: ${value.length}`)
    else parts.push(`${key}: ${value}`)
  }
  return parts.length ? parts.join(' · ') : (data.hint || 'Готово')
}

export default function AdminDiagnosticsClient(){
  const [running,setRunning] = useState('')
  const [result,setResult] = useState(null)
  const [offset,setOffset] = useState('0')
  const [health,setHealth] = useState(null)
  const [healthLoading,setHealthLoading] = useState(true)


  async function loadHealth(){
    setHealthLoading(true)
    try{
      const res = await fetch('/api/health', { cache:'no-store' })
      const payload = await res.json()
      setHealth(payload)
    }catch(error){
      setHealth({ ok:false, status:'error', error:error?.message || 'Не удалось получить health-check' })
    }finally{
      setHealthLoading(false)
    }
  }

  useEffect(()=>{
    loadHealth()
  }, [])

  const healthCards = useMemo(()=>{
    const db = health?.database || {}
    const schedule = health?.schedule || {}
    const env = health?.env || {}
    return [
      { label:'Статус', value:healthLoading ? '…' : (health?.status || '—'), hint:health?.ok ? 'Next.js отвечает' : (health?.error || 'Health недоступен') },
      { label:'Supabase', value:env.supabaseConfigured ? 'OK' : 'OFF', hint:db.ok ? 'База читается' : (db.animeError || 'env/runtime') },
      { label:'Тайтлы', value:db.animeCount ?? '—', hint:`title_ru: ${db.titleRuCount ?? '—'} · без RU: ${db.missingTitleRu ?? '—'}` },
      { label:'Расписание', value:schedule.count ?? '—', hint:schedule.ok ? 'есть записи недели' : (schedule.error || 'нет записей') },
      { label:'Серии', value:db.episodeCount ?? '—', hint:'anime_episodes' },
      { label:'Kodik token', value:env.kodikTokenConfigured ? 'OK' : 'OFF', hint:'значение не показывается' },
    ]
  }, [health, healthLoading])

  const resultText = useMemo(()=>{
    if(!result) return ''
    try{ return JSON.stringify(result.payload || result, null, 2) }catch{ return String(result) }
  }, [result])

  async function run(job){
    setRunning(job.id)
    setResult(null)
    try{
      const body = { job:job.id, ...job.params }
      if(job.id === 'titles') body.offset = offset || 0
      const res = await fetch('/admin/api/cron', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify(body)
      })
      const payload = await res.json()
      if(!payload.ok) throw new Error(payload.error || payload.payload?.error || 'Cron вернул ошибку')
      setResult(payload)
      pushToast(`${job.title}: готово`, 'success')
    }catch(error){
      setResult({ ok:false, error:error?.message || 'Ошибка запуска' })
      pushToast(error?.message || 'Ошибка запуска', 'error')
    }finally{
      setRunning('')
    }
  }

  async function runTitlesFull(){
    setRunning('titles-full')
    setResult(null)
    const collected = []
    try{
      for(const currentOffset of [0,80,160,240,320,400,480,560,640]){
        const res = await fetch('/admin/api/cron', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({ job:'titles', limit:80, offset:currentOffset })
        })
        const payload = await res.json()
        collected.push(payload)
        if(!payload.ok) throw new Error(payload.error || payload.payload?.error || `Ошибка на offset ${currentOffset}`)
      }
      setResult({ ok:true, job:'titles-full', payload:{ batches:collected.map(x => ({ offset:x.payload?.requested?.offset, ...x.payload })) } })
      pushToast('Русские названия: каталог пройден', 'success')
    }catch(error){
      setResult({ ok:false, error:error?.message || 'Ошибка запуска', payload:collected })
      pushToast(error?.message || 'Ошибка запуска', 'error')
    }finally{
      setRunning('')
    }
  }


  async function runTitlesFullAndSchedule(){
    setRunning('titles-full-schedule')
    setResult(null)
    const collected = []
    try{
      for(const currentOffset of [0,80,160,240,320,400,480,560,640]){
        const res = await fetch('/admin/api/cron', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({ job:'titles', limit:80, offset:currentOffset })
        })
        const payload = await res.json()
        collected.push({ step:'titles', offset:currentOffset, result:payload })
        if(!payload.ok) throw new Error(payload.error || payload.payload?.error || `Ошибка title_ru на offset ${currentOffset}`)
      }
      const scheduleRes = await fetch('/admin/api/cron', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ job:'schedule', limit:25, pages:2 })
      })
      const schedulePayload = await scheduleRes.json()
      collected.push({ step:'schedule', result:schedulePayload })
      if(!schedulePayload.ok) throw new Error(schedulePayload.error || schedulePayload.payload?.error || 'Ошибка обновления расписания')
      setResult({ ok:true, job:'titles-full-schedule', payload:{ steps:collected } })
      pushToast('title_ru и расписание обновлены', 'success')
    }catch(error){
      setResult({ ok:false, error:error?.message || 'Ошибка запуска', payload:collected })
      pushToast(error?.message || 'Ошибка запуска', 'error')
    }finally{
      setRunning('')
    }
  }

  return <main className="admin-page admin-tools-page">
    <section className="admin-episodes">
      <div className="page-head admin-page-head-row">
        <div>
          <Link href="/admin">← Админка</Link>
          <h1>Синхронизация и cron</h1>
          <p>Ручной запуск технических задач. Кнопки используют серверный CRON_SECRET и не показывают токен в браузере.</p>
        </div>
        <Link className="secondary" href="/admin/anime">Редактировать тайтлы</Link>
      </div>

      <section className="widget admin-live-health">
        <div className="admin-live-health-head">
          <div>
            <span>health-check</span>
            <h2>Состояние сайта</h2>
            <p>/api/health проверяет Next.js, Supabase, каталог, расписание, серии и env-флаги без раскрытия секретов.</p>
          </div>
          <button type="button" onClick={loadHealth} disabled={healthLoading}>{healthLoading ? 'Проверяем…' : 'Обновить'}</button>
        </div>
        <div className="admin-live-health-grid">
          {healthCards.map(card => <div className="admin-live-health-card" key={card.label}>
            <span>{card.label}</span>
            <b>{card.value}</b>
            <em>{card.hint}</em>
          </div>)}
        </div>
        {health?.warnings?.length ? <div className="admin-live-health-warnings">
          {health.warnings.map(warning => <span key={warning}>{warning}</span>)}
        </div> : null}
      </section>

      <div className="admin-cron-grid">
        {jobs.map(job => <article className="widget admin-cron-card" key={job.id}>
          <div>
            <span>{job.id}</span>
            <h3>{job.title}</h3>
            <p>{job.text}</p>
          </div>
          {job.id === 'titles' ? <label className="admin-offset-input">offset<input value={offset} onChange={e=>setOffset(e.target.value)} inputMode="numeric"/></label> : null}
          <button onClick={()=>run(job)} disabled={Boolean(running)}>{running === job.id ? 'Запуск…' : 'Запустить'}</button>
        </article>)}
      </div>

      <section className="widget admin-cron-wide admin-cron-wide-tools">
        <div>
          <h2>Быстрая русификация всего каталога</h2>
          <p>Без force=1: заполняет только пустые title_ru и не затирает ручные правки. Можно сразу обновить расписание после прохода.</p>
        </div>
        <div className="admin-cron-wide-buttons">
          <button onClick={runTitlesFull} disabled={Boolean(running)}>{running === 'titles-full' ? 'Идёт проход…' : 'Только title_ru'}</button>
          <button onClick={runTitlesFullAndSchedule} disabled={Boolean(running)}>{running === 'titles-full-schedule' ? 'Идёт проход…' : 'title_ru + расписание'}</button>
        </div>
      </section>

      {result ? <section className="widget admin-result-box">
        <div className="widget-head"><h3>{result.ok ? 'Готово' : 'Ошибка'}</h3><span>{summarize(result)}</span></div>
        <pre>{resultText}</pre>
      </section> : null}
    </section>
  </main>
}
