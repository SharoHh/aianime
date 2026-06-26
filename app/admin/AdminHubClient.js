'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { adminFetch, openAdminWithSecret } from './adminClient'

function StatCard({ label, value, tone = '', href }){
  const content = <div className={`av244-card ${tone}`}><span>{label}</span><b>{value ?? '—'}</b></div>
  return href ? <Link href={openAdminWithSecret(href)} className="av244-link-card">{content}</Link> : content
}

function ShellStyles(){
  return <style>{`
    .admin-v244-page{min-height:100vh;background:#f6f4ef;color:#201c3a;font-family:Manrope,system-ui,sans-serif;padding:28px}.av244{max-width:1380px;margin:0 auto}.av244-top{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:20px}.av244-kicker{font-size:12px;text-transform:uppercase;letter-spacing:.13em;font-weight:850;color:#8c839b}.av244 h1{font-size:42px;line-height:1;margin:7px 0 10px;font-weight:900;letter-spacing:-.055em}.av244 p{color:#746e86;line-height:1.55}.av244-nav{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.av244-nav a,.av244-btn{border:1px solid rgba(32,28,58,.13);background:#fff;color:#201c3a;border-radius:15px;padding:11px 14px;text-decoration:none;font-weight:850;box-shadow:0 12px 28px rgba(32,28,58,.06);cursor:pointer}.av244-nav a.primary,.av244-btn.primary{background:#201c3a;color:#fff}.av244-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0}.av244-link-card{text-decoration:none;color:inherit}.av244-card{background:white;border:1px solid rgba(32,28,58,.1);border-radius:22px;padding:18px;box-shadow:0 18px 40px rgba(32,28,58,.07);min-height:92px}.av244-card span{display:block;color:#746e86;font-size:13px;font-weight:800}.av244-card b{display:block;font-size:32px;line-height:1.05;margin-top:9px}.av244-card.bad b{color:#8b1d31}.av244-card.warn b{color:#9b6a00}.av244-layout{display:grid;grid-template-columns:1.15fr .85fr;gap:14px;margin-top:14px}.av244-panel{background:white;border:1px solid rgba(32,28,58,.1);border-radius:24px;padding:18px;box-shadow:0 18px 40px rgba(32,28,58,.07)}.av244-panel h2{margin:0 0 8px;font-size:21px}.av244-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:13px}.av244-action{border:1px solid rgba(32,28,58,.1);border-radius:18px;padding:14px;text-decoration:none;color:#201c3a;background:#fbfaf7}.av244-action b{display:block;font-size:15px}.av244-action span{display:block;color:#746e86;font-size:12px;line-height:1.45;margin-top:4px}.av244-log{white-space:pre-wrap;background:#19162a;color:#fff;border-radius:18px;padding:14px;font-size:12px;line-height:1.45;max-height:260px;overflow:auto}.av244-warning{background:#fff2c7;border:1px solid #f2d16d;border-radius:18px;padding:12px;color:#6a4a00;font-weight:750;margin:10px 0}.av244-ok{background:#e9f9ee;border:1px solid #b9e7c5;border-radius:18px;padding:12px;color:#23572f;font-weight:750;margin:10px 0}@media(max-width:900px){.admin-v244-page{padding:16px}.av244-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.av244-layout{grid-template-columns:1fr}.av244 h1{font-size:32px}.av244-actions{grid-template-columns:1fr}}
  `}</style>
}

export default function AdminHubClient(){
  const [animeData,setAnimeData] = useState(null)
  const [health,setHealth] = useState(null)
  const [settings,setSettings] = useState(null)
  const [loading,setLoading] = useState(true)
  const [log,setLog] = useState('')

  async function load(){
    setLoading(true)
    try{
      const [anime, healthRes, settingsRes] = await Promise.all([
        adminFetch('/admin/api/anime?limit=1'),
        fetch('/api/health', { cache:'no-store' }).then(r => r.json()).catch(e => ({ ok:false, error:e.message })),
        adminFetch('/admin/api/settings').catch(e => ({ ok:false, error:e.message, warnings:[e.message] })),
      ])
      setAnimeData(anime)
      setHealth(healthRes)
      setSettings(settingsRes)
      setLog('Админка загружена. Публичный сайт этим экраном не меняется.')
    }catch(error){
      setLog(error?.message || 'Ошибка загрузки админки')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [])

  const stats = animeData?.stats || {}
  const database = health?.database || {}
  const warnings = useMemo(()=>[
    ...(Array.isArray(health?.warnings) ? health.warnings : []),
    ...(Array.isArray(settings?.warnings) ? settings.warnings : []),
  ], [health, settings])

  return <div className="av244">
    <ShellStyles />
    <header className="av244-top">
      <div>
        <div className="av244-kicker">AIanime admin v246</div>
        <h1>Панель управления</h1>
        <p>Новая админка без минного поля: тайтлы, проблемы каталога, задачи, импорт и env в отдельных разделах. Массовые опасные действия — только через отдельный центр задач.</p>
      </div>
      <button className="av244-btn" onClick={load} disabled={loading}>{loading ? 'Обновляю…' : 'Обновить'}</button>
    </header>

    <nav className="av244-nav">
      <Link className="primary" href={openAdminWithSecret('/admin/anime')}>Тайтлы</Link>
      <Link href={openAdminWithSecret('/admin/tasks')}>Задачи</Link>
      <Link href={openAdminWithSecret('/admin/import')}>Импорт</Link>
      <Link href={openAdminWithSecret('/admin/settings')}>Настройки</Link>
      <Link href={openAdminWithSecret('/admin/comments')}>Комментарии</Link>
      <Link href={openAdminWithSecret('/admin/reports')}>Жалобы</Link>
      <Link href="/">На сайт</Link>
    </nav>

    {warnings.length ? <div className="av244-warning">{warnings.slice(0, 6).join(' · ')}</div> : <div className="av244-ok">Критичных предупреждений в сводке нет.</div>}

    <section className="av244-grid">
      <StatCard label="Тайтлы в базе" value={stats.total ?? database.animeCount} href="/admin/anime" />
      <StatCard label="Без RU" value={stats.missing_ru ?? database.missingTitleRu} tone={(stats.missing_ru || database.missingTitleRu) ? 'bad' : ''} href="/admin/anime?filter=missing_ru" />
      <StatCard label="Без постера" value={stats.missing_poster} tone={stats.missing_poster ? 'bad' : ''} href="/admin/anime?filter=missing_poster" />
      <StatCard label="Плохой постер" value={stats.bad_poster} tone={stats.bad_poster ? 'bad' : ''} href="/admin/anime?filter=bad_poster" />
      <StatCard label="Без описания" value={stats.missing_description} tone={stats.missing_description ? 'warn' : ''} href="/admin/anime?filter=missing_description" />
      <StatCard label="Без жанров" value={stats.missing_genres} tone={stats.missing_genres ? 'warn' : ''} href="/admin/anime?filter=missing_genres" />
      <StatCard label="Без плеера" value={stats.missing_player} tone={stats.missing_player ? 'bad' : ''} href="/admin/anime?filter=missing_player" />
      <StatCard label="Закрыто в РФ" value={stats.restricted || 0} tone={stats.restricted ? 'bad' : ''} href="/admin/anime?filter=restricted" />
      <StatCard label="Расписание" value={health?.schedule?.count ?? '—'} tone={health?.schedule?.ok ? '' : 'warn'} href="/admin/tasks" />
    </section>

    <section className="av244-layout">
      <div className="av244-panel">
        <h2>Рабочие разделы</h2>
        <p>Старые дубли не удалены физически, но основной поток теперь здесь: найти проблему → открыть тайтл → сохранить конкретные поля → проверить.</p>
        <div className="av244-actions">
          <Link className="av244-action" href={openAdminWithSecret('/admin/anime')}><b>Менеджер тайтлов</b><span>Поиск, фильтры, сохранение title_ru/poster/description/genres/player issues.</span></Link>
          <Link className="av244-action" href={openAdminWithSecret('/admin/tasks')}><b>Центр задач</b><span>Cron без хаоса: расписание, RU, Kodik, проверка каталога.</span></Link>
          <Link className="av244-action" href={openAdminWithSecret('/admin/import')}><b>Импорт</b><span>Поиск в Jikan, preview кандидатов, импорт по MAL ID.</span></Link>
          <Link className="av244-action" href={openAdminWithSecret('/admin/settings')}><b>Настройки</b><span>Env, секреты, дубли ADMIN_SECRET, Supabase/Kodik/Cron.</span></Link>
        </div>
      </div>
      <div className="av244-panel">
        <h2>Лог</h2>
        <div className="av244-log">{log}</div>
      </div>
    </section>
  </div>
}
