'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

const actions = [
  {
    id:'diagnostics',
    title:'Глубокая диагностика',
    description:'Проверить Supabase, Jikan, Kodik, таблицы и статусы.',
    url:'/api/admin/diagnostics?deep=1',
    tone:'primary'
  },
  {
    id:'seed',
    title:'Seed sync',
    description:'Быстро проверить локальный каталог без внешних API.',
    url:'/api/cron/sync?seed=1',
    tone:'secondary'
  },
  {
    id:'jikan',
    title:'Jikan sync',
    description:'Импорт каталога из Jikan / MyAnimeList.',
    url:'/api/cron/sync?enable=1&pages=2&limit=25',
    tone:'primary'
  },
  {
    id:'kodik',
    title:'Kodik metadata',
    description:'Русские названия, озвучка, качество и Kodik id.',
    url:'/api/cron/sync-kodik?enable=1&limit=20&all=1',
    tone:'primary'
  },
  {
    id:'players',
    title:'Kodik players',
    description:'Подтянуть embed-плееры в anime_episodes.',
    url:'/api/cron/players?enable=1&limit=20',
    tone:'primary'
  },
]

function statusClass(value){
  if(value === true) return 'ok'
  if(value === false) return 'bad'
  return 'warn'
}

function statusText(value){
  if(value === true) return 'OK'
  if(value === false) return 'Ошибка'
  return 'Не проверено'
}

function formatDate(value){
  if(!value) return '—'
  try{
    return new Intl.DateTimeFormat('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(value))
  }catch{
    return value
  }
}

function shortJson(data){
  if(!data) return ''
  return JSON.stringify(data, null, 2)
}

export default function AdminDiagnosticsClient(){
  const [diagnostics,setDiagnostics] = useState(null)
  const [loading,setLoading] = useState(true)
  const [deepLoading,setDeepLoading] = useState(false)
  const [running,setRunning] = useState(null)
  const [lastResult,setLastResult] = useState(null)
  const [error,setError] = useState('')
  const [tokenInput,setTokenInput] = useState('')
  const [tokenChecking,setTokenChecking] = useState(false)
  const [tokenResult,setTokenResult] = useState(null)

  async function loadDiagnostics({ deep = false } = {}){
    if(deep) setDeepLoading(true)
    else setLoading(true)
    setError('')
    try{
      const res = await fetch(`/api/admin/diagnostics${deep ? '?deep=1' : ''}`, { cache:'no-store' })
      const json = await res.json()
      setDiagnostics(json)
      if(deep) setLastResult({ title:'Глубокая диагностика', url:'/api/admin/diagnostics?deep=1', json })
    }catch(err){
      setError(err?.message || String(err))
    }finally{
      setLoading(false)
      setDeepLoading(false)
    }
  }

  async function runAction(action){
    setRunning(action.id)
    setError('')
    try{
      const res = await fetch(action.url, { cache:'no-store' })
      const json = await res.json().catch(async () => ({ ok:false, raw: await res.text() }))
      setLastResult({ title:action.title, url:action.url, json })
      await loadDiagnostics({ deep:false })
    }catch(err){
      const message = err?.message || String(err)
      setError(message)
      setLastResult({ title:action.title, url:action.url, json:{ ok:false, error:message } })
    }finally{
      setRunning(null)
    }
  }

  async function checkKodikToken(){
    setTokenChecking(true)
    setTokenResult(null)
    setError('')
    try{
      const res = await fetch('/api/admin/kodik-token-test', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ token:tokenInput.trim() })
      })
      const json = await res.json()
      setTokenResult(json)
      setLastResult({ title:'Проверка Kodik token', url:'/api/admin/kodik-token-test', json })
    }catch(err){
      const message = err?.message || String(err)
      setError(message)
      setTokenResult({ ok:false, message })
    }finally{
      setTokenChecking(false)
    }
  }

  async function checkEnvKodikToken(){
    setTokenChecking(true)
    setTokenResult(null)
    setError('')
    try{
      const res = await fetch('/api/admin/kodik-token-test', { cache:'no-store' })
      const json = await res.json()
      setTokenResult(json)
      setLastResult({ title:'Проверка KODIK_TOKEN из env', url:'/api/admin/kodik-token-test', json })
      await loadDiagnostics({ deep:false })
    }catch(err){
      const message = err?.message || String(err)
      setError(message)
      setTokenResult({ ok:false, message })
    }finally{
      setTokenChecking(false)
    }
  }

  useEffect(()=>{
    loadDiagnostics()
  }, [])

  const counts = diagnostics?.counts || {}
  const services = diagnostics?.services || []
  const recommendations = diagnostics?.recommendations || []
  const syncState = diagnostics?.syncState || []

  const healthScore = useMemo(()=>{
    if(!services.length) return 0
    const known = services.filter(item => item.ok !== null && item.ok !== undefined)
    if(!known.length) return 0
    const ok = known.filter(item => item.ok === true).length
    return Math.round((ok / known.length) * 100)
  }, [services])

  return <main className="admin-diagnostics-page">
    <section className="admin-diagnostics-shell">
      <header className="admin-diagnostics-hero">
        <div>
          <Link href="/admin" className="admin-back-link">← Админка</Link>
          <h1>Диагностика AIanime</h1>
          <p>Jikan, Kodik, Supabase, миграции, cron и плееры — в одном месте. Главную страницу и публичный дизайн этот раздел не меняет.</p>
        </div>
        <div className="admin-health-ring">
          <span>{loading ? '…' : `${healthScore}%`}</span>
          <em>health</em>
        </div>
      </header>

      {error ? <div className="admin-diag-alert bad">{error}</div> : null}

      <section className="admin-diag-top-grid">
        <article className="admin-diag-count-card">
          <span>Аниме в базе</span>
          <b>{counts.anime ?? '—'}</b>
          <em>Всего записей в Supabase anime</em>
        </article>
        <article className="admin-diag-count-card">
          <span>Jikan / MAL</span>
          <b>{counts.withMal ?? '—'}</b>
          <em>Тайтлов с MAL id</em>
        </article>
        <article className="admin-diag-count-card">
          <span>Kodik metadata</span>
          <b>{counts.withKodik ?? '—'}</b>
          <em>Тайтлов с Kodik id</em>
        </article>
        <article className="admin-diag-count-card">
          <span>Плееры</span>
          <b>{counts.players ?? '—'}</b>
          <em>Embed-ссылок в anime_episodes</em>
        </article>
      </section>

      <section className="admin-diag-section">
        <div className="admin-diag-head">
          <div>
            <h2>Статусы системы</h2>
            <p>Показывает, что реально работает сейчас, а что только настроено частично.</p>
          </div>
          <button onClick={()=>loadDiagnostics({ deep:true })} disabled={deepLoading || running} className="admin-diag-btn primary">
            {deepLoading ? 'Проверяю…' : 'Глубокая диагностика'}
          </button>
        </div>

        <div className="admin-service-grid">
          {services.map(service=><article className={`admin-service-card ${statusClass(service.ok)}`} key={service.id}>
            <div>
              <span className={`admin-status-dot ${statusClass(service.ok)}`}/>
              <b>{service.title}</b>
            </div>
            <strong>{service.status || statusText(service.ok)}</strong>
            <p>{service.hint}</p>
          </article>)}
        </div>
      </section>

      <section className="admin-diag-section">
        <div className="admin-diag-head">
          <div>
            <h2>Kodik token</h2>
            <p>Проверка токена без сохранения в проект. Если токен рабочий — вставь его в .env.local как KODIK_TOKEN и перезапусти dev server.</p>
          </div>
          <button onClick={checkEnvKodikToken} disabled={tokenChecking || running} className="admin-diag-btn secondary">
            {tokenChecking ? 'Проверяю…' : 'Проверить env token'}
          </button>
        </div>

        <div className="admin-token-check-card">
          <div>
            <label htmlFor="kodik-token-input">Временная проверка токена</label>
            <input
              id="kodik-token-input"
              type="password"
              value={tokenInput}
              onChange={(event)=>setTokenInput(event.target.value)}
              placeholder="Вставь Kodik token для проверки"
              autoComplete="off"
            />
            <p>Токен не записывается в файлы и не сохраняется через API.</p>
          </div>
          <button onClick={checkKodikToken} disabled={tokenChecking || !tokenInput.trim()} className="admin-diag-btn primary">
            {tokenChecking ? 'Проверяю…' : 'Проверить'}
          </button>
        </div>

        {tokenResult ? <div className={`admin-token-result ${tokenResult.ok ? 'ok' : 'bad'}`}>
          <b>{tokenResult.ok ? 'Токен рабочий' : 'Токен не прошёл проверку'}</b>
          <p>{tokenResult.message || tokenResult.hint || 'Ответ получен.'}</p>
          {tokenResult.tokenMask ? <code>{tokenResult.tokenMask}</code> : null}
        </div> : null}
      </section>

      <section className="admin-diag-section">
        <div className="admin-diag-head">
          <div>
            <h2>Запуск синхронизации</h2>
            <p>Запускай по порядку: Jikan → Kodik metadata → Kodik players. Результат появится ниже.</p>
          </div>
        </div>

        <div className="admin-action-grid">
          {actions.map(action=><article className="admin-action-card" key={action.id}>
            <div>
              <b>{action.title}</b>
              <p>{action.description}</p>
              <code>{action.url}</code>
            </div>
            <button disabled={Boolean(running)} onClick={()=> action.id === 'diagnostics' ? loadDiagnostics({ deep:true }) : runAction(action)} className={`admin-diag-btn ${action.tone}`}>
              {running === action.id || (action.id === 'diagnostics' && deepLoading) ? 'Запуск…' : 'Запустить'}
            </button>
          </article>)}
        </div>
      </section>

      <section className="admin-diag-two-col">
        <article className="admin-diag-section small">
          <h2>SQL / миграции</h2>
          <div className="admin-schema-list">
            <div>
              <b>anime</b>
              <span className={diagnostics?.supabase?.tables?.anime?.ok ? 'ok' : 'bad'}>{diagnostics?.supabase?.tables?.anime?.ok ? 'OK' : 'Проверить'}</span>
              {diagnostics?.supabase?.tables?.anime?.missingColumns?.length ? <p>Нет колонок: {diagnostics.supabase.tables.anime.missingColumns.join(', ')}</p> : <p>Колонки для Jikan/Kodik готовы.</p>}
            </div>
            <div>
              <b>anime_episodes</b>
              <span className={diagnostics?.supabase?.tables?.anime_episodes?.ok ? 'ok' : 'bad'}>{diagnostics?.supabase?.tables?.anime_episodes?.ok ? 'OK' : 'Проверить'}</span>
              {diagnostics?.supabase?.tables?.anime_episodes?.missingColumns?.length ? <p>Нет колонок: {diagnostics.supabase.tables.anime_episodes.missingColumns.join(', ')}</p> : <p>Таблица плееров готова.</p>}
            </div>
            <div>
              <b>sync_state</b>
              <span className={diagnostics?.supabase?.tables?.sync_state?.ok ? 'ok' : 'bad'}>{diagnostics?.supabase?.tables?.sync_state?.ok ? 'OK' : 'Проверить'}</span>
              <p>{diagnostics?.supabase?.tables?.sync_state?.ok ? 'Cursor для cron работает.' : 'Нужна jikan/kodik migration.'}</p>
            </div>
          </div>
        </article>

        <article className="admin-diag-section small">
          <h2>Последние cron state</h2>
          <div className="admin-sync-state-list">
            {syncState.length ? syncState.map(row=><div key={row.id}>
              <b>{row.id}</b>
              <span>{row.last_status || '—'} · next page {row.next_page || 1}</span>
              <em>{formatDate(row.last_finished_at || row.updated_at)}</em>
              {row.last_error ? <p>{row.last_error}</p> : null}
            </div>) : <p className="admin-diag-muted">Пока нет записей sync_state. Запусти авто-sync хотя бы один раз.</p>}
          </div>
        </article>
      </section>

      {recommendations.length ? <section className="admin-diag-section">
        <h2>Что исправить</h2>
        <div className="admin-recommendations">
          {recommendations.map((item,index)=><div key={index}><span>{index + 1}</span><p>{item}</p></div>)}
        </div>
      </section> : null}

      {lastResult ? <section className="admin-diag-section">
        <div className="admin-diag-head">
          <div>
            <h2>Последний ответ API</h2>
            <p>{lastResult.title} · {lastResult.url}</p>
          </div>
          <a href={lastResult.url} target="_blank" className="admin-open-json">Открыть JSON</a>
        </div>
        <pre className="admin-json-output">{shortJson(lastResult.json)}</pre>
      </section> : null}
    </section>
  </main>
}
