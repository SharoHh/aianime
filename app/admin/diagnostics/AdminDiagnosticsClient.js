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
  { id:'russify', title:'Описание и жанры', text:'Русификация description_ru/genres без затирания хорошего контента.', params:{ limit:80, clean:1 } },
  { id:'missingTitles', title:'Добор мини/спешлов', text:'Добавляет ONA/Special/Mini Anime, которые не попали в основной popularity-sync.', params:{ preset:'mini', pages:1, limit:12 } },
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
  const [catalogIssues,setCatalogIssues] = useState(null)
  const [catalogIssuesLoading,setCatalogIssuesLoading] = useState(true)
  const [missingQuery,setMissingQuery] = useState('')
  const [missingType,setMissingType] = useState('')
  const [missingSearch,setMissingSearch] = useState(null)
  const [missingLoading,setMissingLoading] = useState(false)
  const [importingMalId,setImportingMalId] = useState('')


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



  async function loadCatalogIssues(){
    setCatalogIssuesLoading(true)
    try{
      const res = await fetch('/admin/api/catalog-issues', { cache:'no-store' })
      const payload = await res.json()
      setCatalogIssues(payload)
    }catch(error){
      setCatalogIssues({ ok:false, error:error?.message || 'Не удалось получить список проблем каталога' })
    }finally{
      setCatalogIssuesLoading(false)
    }
  }


  useEffect(()=>{
    loadHealth()
    loadCatalogIssues()
  }, [])

  const healthCards = useMemo(()=>{
    const db = health?.database || {}
    const schedule = health?.schedule || {}
    const env = health?.env || {}
    const userData = health?.userData || {}
    return [
      { label:'Статус', value:healthLoading ? '…' : (health?.status || '—'), hint:health?.ok ? 'Next.js отвечает' : (health?.error || 'Health недоступен') },
      { label:'Supabase', value:env.supabaseConfigured ? 'OK' : 'OFF', hint:db.ok ? 'База читается' : (db.animeError || 'env/runtime') },
      { label:'Тайтлы', value:db.animeCount ?? '—', hint:`title_ru: ${db.titleRuCount ?? '—'} · без RU: ${db.missingTitleRu ?? '—'}` },
      { label:'Расписание', value:schedule.count ?? '—', hint:schedule.ok ? 'есть записи недели' : (schedule.error || 'нет записей') },
      { label:'Серии', value:db.episodeCount ?? '—', hint:'anime_episodes' },
      { label:'Kodik token', value:env.kodikTokenConfigured ? 'OK' : 'OFF', hint:'значение не показывается' },
      { label:'Профили', value:userData.profilesCount ?? '—', hint:'profiles' },
      { label:'Избранное', value:userData.favoritesCount ?? '—', hint:'user_favorites' },
      { label:'История', value:userData.historyCount ?? '—', hint:'user_history' },
      { label:'Оценки', value:userData.ratingsCount ?? '—', hint:'user_ratings' },
      { label:'Лайки комм.', value:userData.commentLikesCount ?? '—', hint:'anime_comment_likes' },
    ]
  }, [health, healthLoading])

  const resultText = useMemo(()=>{
    if(!result) return ''
    try{ return JSON.stringify(result.payload || result, null, 2) }catch{ return String(result) }
  }, [result])


  async function searchMissingTitle(){
    const q = missingQuery.trim()
    if(!q){
      pushToast('Введи название тайтла', 'error')
      return
    }
    setMissingLoading(true)
    setMissingSearch(null)
    try{
      const params = new URLSearchParams({ q, limit:'10' })
      if(missingType) params.set('type', missingType)
      const res = await fetch(`/admin/api/title-search?${params.toString()}`, { cache:'no-store' })
      const payload = await res.json()
      if(!payload.ok) throw new Error(payload.error || 'Поиск не сработал')
      setMissingSearch(payload)
      pushToast(payload.candidates?.length ? 'Найдены варианты для импорта' : 'Jikan ничего не нашёл', payload.candidates?.length ? 'success' : 'error')
    }catch(error){
      setMissingSearch({ ok:false, error:error?.message || 'Ошибка поиска' })
      pushToast(error?.message || 'Ошибка поиска', 'error')
    }finally{
      setMissingLoading(false)
    }
  }

  async function importMissingTitle(candidate){
    if(!candidate?.malId) return
    setImportingMalId(String(candidate.malId))
    try{
      const res = await fetch('/admin/api/import-title', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ malId:candidate.malId, titleRu:missingQuery })
      })
      const payload = await res.json()
      if(!payload.ok) throw new Error(payload.error || 'Импорт не сработал')
      setResult(payload)
      pushToast('Тайтл добавлен/обновлён в Supabase', 'success')
      await Promise.all([loadHealth(), loadCatalogIssues()])
      setMissingSearch(prev => prev ? ({
        ...prev,
        candidates:(prev.candidates || []).map(item => item.malId === candidate.malId ? { ...item, exists:true, existing:payload.item } : item)
      }) : prev)
    }catch(error){
      pushToast(error?.message || 'Ошибка импорта', 'error')
      setResult({ ok:false, error:error?.message || 'Ошибка импорта' })
    }finally{
      setImportingMalId('')
    }
  }

  async function run(job){
    setRunning(job.id)
    setResult(null)
    try{
      const body = { job:job.id, ...job.params }
      if(job.id === 'titles' || job.id === 'russify') body.offset = offset || 0
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

  async function runContentFull(){
    setRunning('content-full')
    setResult(null)
    const collected = []
    try{
      for(const currentOffset of [0,80,160,240,320,400,480,560,640]){
        const res = await fetch('/admin/api/cron', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({ job:'russify', limit:80, offset:currentOffset, clean:1 })
        })
        const payload = await res.json()
        collected.push({ offset:currentOffset, result:payload })
        if(!payload.ok) throw new Error(payload.error || payload.payload?.error || `Ошибка описаний/жанров на offset ${currentOffset}`)
      }
      setResult({ ok:true, job:'content-full', payload:{ batches:collected } })
      pushToast('Описание и жанры: каталог пройден', 'success')
    }catch(error){
      setResult({ ok:false, error:error?.message || 'Ошибка запуска', payload:collected })
      pushToast(error?.message || 'Ошибка запуска', 'error')
    }finally{
      setRunning('')
    }
  }


  const issueLabels = {
    missing_title_ru:'Нет title_ru',
    bad_title_symbols:'Мусор в названии',
    missing_poster:'Нет постера',
    missing_description_ru:'Нет RU-описания',
    english_ru_content:'Английский RU-контент',
    missing_kodik:'Нет Kodik',
    missing_player_episodes:'Нет серий',
    partial_player_episodes:'Неполный плеер',
    few_player_voices:'Мало озвучек'
  }

  const issueRows = Array.isArray(catalogIssues?.issues) ? catalogIssues.issues.slice(0, 40) : []
  const issueSummary = catalogIssues?.summary || { total:0, byIssue:{}, bySeverity:{} }


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



      <section className="widget admin-catalog-issues">
        <div className="admin-live-health-head">
          <div>
            <span>catalog quality</span>
            <h2>Проблемные тайтлы</h2>
            <p>Не только общие цифры из health, а конкретные slug: что без title_ru, где мусор, где нет Kodik/серий/описания.</p>
          </div>
          <button type="button" onClick={loadCatalogIssues} disabled={catalogIssuesLoading}>{catalogIssuesLoading ? 'Проверяем…' : 'Обновить'}</button>
        </div>
        <div className="admin-issue-summary">
          <span><b>{catalogIssuesLoading ? '…' : (issueSummary.total ?? 0)}</b> всего</span>
          <span><b>{issueSummary.bySeverity?.error ?? 0}</b> критичных</span>
          <span><b>{issueSummary.bySeverity?.warning ?? 0}</b> предупреждений</span>
          <span><b>{catalogIssues?.animeCount ?? '—'}</b> тайтлов проверено</span>
        </div>
        {catalogIssues?.error ? <div className="admin-live-health-warnings"><span>{catalogIssues.error}</span></div> : null}
        {issueRows.length ? <div className="admin-issue-table-wrap">
          <table className="admin-issue-table">
            <thead><tr><th>Тайтл</th><th>Проблема</th><th>Подсказка</th><th></th></tr></thead>
            <tbody>
              {issueRows.map((item, index) => <tr key={`${item.slug}-${item.issue}-${index}`} className={`severity-${item.severity}`}>
                <td><b>{item.title}</b><small>{item.slug}{item.year ? ` · ${item.year}` : ''}</small></td>
                <td><span>{issueLabels[item.issue] || item.issue}</span></td>
                <td>{item.hint || 'Проверь карточку'}</td>
                <td><Link href={`/admin/anime?q=${encodeURIComponent(item.slug)}`}>Открыть</Link></td>
              </tr>)}
            </tbody>
          </table>
        </div> : <div className="admin-empty-inline">{catalogIssuesLoading ? 'Сканируем каталог…' : 'Явных проблем не найдено.'}</div>}
      </section>


      <section className="widget admin-missing-title-tool">
        <div className="admin-live-health-head">
          <div>
            <span>missing title import</span>
            <h2>Найти и добавить отсутствующий тайтл</h2>
            <p>Для мини-аниме, ONA, Special и коротких спешлов: ищет по Jikan/MAL и сохраняет найденный тайтл в Supabase, не трогая остальные записи.</p>
          </div>
          <Link className="secondary" href="/admin/anime?filter=missingTitle">Без русского</Link>
        </div>
        <div className="admin-missing-search-row">
          <input
            value={missingQuery}
            onChange={e=>setMissingQuery(e.target.value)}
            onKeyDown={e=>{ if(e.key === 'Enter') searchMissingTitle() }}
            placeholder="Например: Любовь с кончиков пальцев: Мини-аниме / Yubisaki to Renren Mini Anime"
          />
          <select value={missingType} onChange={e=>setMissingType(e.target.value)} aria-label="Тип тайтла">
            <option value="">Любой тип</option>
            <option value="tv">TV</option>
            <option value="movie">Movie</option>
            <option value="ona">ONA / mini</option>
            <option value="special">Special</option>
            <option value="ova">OVA</option>
          </select>
          <button type="button" onClick={searchMissingTitle} disabled={missingLoading}>{missingLoading ? 'Ищем…' : 'Найти'}</button>
        </div>
        {missingSearch?.error ? <div className="admin-live-health-warnings"><span>{missingSearch.error}</span></div> : null}
        {missingSearch?.attempts?.length ? <div className="admin-missing-attempts">
          {missingSearch.attempts.map((attempt,index) => <span key={`${attempt.q}-${index}`}>{attempt.q}: {attempt.error ? 'ошибка' : `${attempt.count} шт.`}</span>)}
        </div> : null}
        {missingSearch?.candidates?.length ? <div className="admin-missing-candidates">
          {missingSearch.candidates.map(candidate => <article key={candidate.malId || candidate.slug} className={candidate.exists ? 'is-existing' : ''}>
            {candidate.posterUrl ? <img src={candidate.posterUrl} alt="" loading="lazy"/> : <div className="admin-missing-poster"/>}
            <div>
              <b>{candidate.title}</b>
              <span>{candidate.originalTitle}</span>
              <small>MAL {candidate.malId} · {candidate.type || candidate.kind || 'anime'}{candidate.year ? ` · ${candidate.year}` : ''}{candidate.episodes ? ` · ${candidate.episodes} эп.` : ''}</small>
              {candidate.exists ? <em>Уже есть: {candidate.existing?.slug || candidate.slug}</em> : <em>Можно добавить в каталог</em>}
            </div>
            <button type="button" onClick={()=>importMissingTitle(candidate)} disabled={Boolean(importingMalId) || candidate.exists}>
              {importingMalId === String(candidate.malId) ? 'Импорт…' : candidate.exists ? 'Уже есть' : 'Добавить'}
            </button>
          </article>)}
        </div> : missingSearch?.ok ? <div className="admin-empty-inline">Ничего не найдено. Попробуй латинское название или тип ONA/Special.</div> : null}
        <div className="admin-missing-hint">
          <b>Быстрый cron:</b> если нужно добрать пачку мини/спешлов, ниже есть кнопка “Добор мини/спешлов”. Для конкретного тайтла надёжнее использовать поиск выше.
        </div>
      </section>

      <div className="admin-cron-grid">
        {jobs.map(job => <article className="widget admin-cron-card" key={job.id}>
          <div>
            <span>{job.id}</span>
            <h3>{job.title}</h3>
            <p>{job.text}</p>
          </div>
          {job.id === 'titles' || job.id === 'russify' ? <label className="admin-offset-input">offset<input value={offset} onChange={e=>setOffset(e.target.value)} inputMode="numeric"/></label> : null}
          <button onClick={()=>run(job)} disabled={Boolean(running)}>{running === job.id ? 'Запуск…' : 'Запустить'}</button>
        </article>)}
      </div>

      <section className="widget admin-cron-wide admin-cron-wide-tools">
        <div>
          <h2>Быстрая русификация всего каталога</h2>
          <p>Без force=1: заполняет пустые title_ru, обновляет короткие/пустые description_ru и переводит английские жанры. Хорошие ручные правки не затирает.</p>
        </div>
        <div className="admin-cron-wide-buttons">
          <button onClick={runTitlesFull} disabled={Boolean(running)}>{running === 'titles-full' ? 'Идёт проход…' : 'Только title_ru'}</button>
          <button onClick={runTitlesFullAndSchedule} disabled={Boolean(running)}>{running === 'titles-full-schedule' ? 'Идёт проход…' : 'title_ru + расписание'}</button>
          <button onClick={runContentFull} disabled={Boolean(running)}>{running === 'content-full' ? 'Идёт проход…' : 'description_ru + жанры'}</button>
        </div>
      </section>

      {result ? <section className="widget admin-result-box">
        <div className="widget-head"><h3>{result.ok ? 'Готово' : 'Ошибка'}</h3><span>{summarize(result)}</span></div>
        <pre>{resultText}</pre>
      </section> : null}
    </section>
  </main>
}
