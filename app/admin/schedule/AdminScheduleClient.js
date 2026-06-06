'use client'

import Link from 'next/link'
import { useState } from 'react'
import { pushToast } from '@/components/ToastCenter'

export default function AdminScheduleClient({ weekly = null }){
  const [running,setRunning] = useState(false)
  const [lastResult,setLastResult] = useState(null)

  async function refreshSchedule(){
    setRunning(true)
    setLastResult(null)
    try{
      const res = await fetch('/admin/api/cron', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ job:'schedule', limit:25, pages:2 })
      })
      const payload = await res.json()
      if(!payload.ok) throw new Error(payload.error || payload.payload?.error || 'Не удалось обновить расписание')
      setLastResult(payload.payload)
      pushToast('Расписание обновлено', 'success')
    }catch(error){
      setLastResult({ ok:false, error:error?.message || 'Ошибка' })
      pushToast(error?.message || 'Ошибка обновления', 'error')
    }finally{
      setRunning(false)
    }
  }

  const days = weekly?.days || []
  const total = days.reduce((sum, day) => sum + (day.items?.length || 0), 0)

  return <section className="admin-schedule-admin">
    <div className="widget admin-cron-wide">
      <div>
        <h2>Реальное расписание</h2>
        <p>Сейчас расписание читается из Supabase `anime_schedule`. Ручные локальные заглушки убраны, чтобы админка показывала то же, что видит пользователь.</p>
      </div>
      <button onClick={refreshSchedule} disabled={running}>{running ? 'Обновляю…' : 'Обновить cron'}</button>
    </div>

    <div className="admin-hub-stats admin-schedule-stats">
      <div><span>Неделя</span><b>{days.length || 7}</b></div>
      <div><span>Релизы</span><b>{total}</b></div>
      <div><span>Источник</span><b>{weekly?.hasData ? 'LIVE' : 'EMPTY'}</b></div>
      <div><span>Часовой пояс</span><b>{weekly?.timeZone || '—'}</b></div>
    </div>

    {lastResult ? <div className="widget admin-result-box">
      <div className="widget-head"><h3>Ответ cron</h3><span>{lastResult.saved || lastResult.matched || 0} сохранено/найдено</span></div>
      <pre>{JSON.stringify(lastResult, null, 2)}</pre>
    </div> : null}

    <section className="admin-schedule-days">
      {days.map(day => <article className="widget admin-schedule-day" key={day.key}>
        <header>
          <div><b>{day.name}</b><span>{day.month} · {day.date}</span></div>
          <em>{day.isToday ? 'сегодня' : day.countText}</em>
        </header>
        <div className="admin-schedule-list">
          {day.items?.length ? day.items.map(item => <Link href={item.href || `/anime/${item.slug}`} key={item.notifyKey || `${day.key}-${item.slug}-${item.time}`}>
            <img src={item.poster || '/posters/magic2.svg'} alt=""/>
            <div><b>{item.time} · {item.title}</b><span>{item.meta} · {item.sourceLabel || 'Jikan/MAL'}</span></div>
          </Link>) : <div className="admin-empty-line">Нет релизов</div>}
        </div>
      </article>)}
    </section>
  </section>
}
