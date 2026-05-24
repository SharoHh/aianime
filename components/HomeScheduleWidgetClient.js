'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { pushToast } from '@/components/ToastCenter'

const dayLabels = [
  ['Пн', '13'],
  ['Вт', '14'],
  ['Ср', '15'],
  ['Чт', '16'],
  ['Пт', '17'],
  ['Сб', '18'],
  ['Вс', '19'],
]

function normalizeSchedule(schedule = []) {
  const base = schedule.map((item, index) => ({
    time: item[0],
    title: item[1],
    meta: item[2],
    poster: item[3],
    slug: item[4] || item[1]?.toLowerCase?.().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '') || `schedule-${index}`,
  }))

  return {
    0: [base[0], base[3]].filter(Boolean),
    1: base.slice(0, 3),
    2: [base[1], base[4], base[2]].filter(Boolean),
    3: [base[2], base[0], base[4]].filter(Boolean),
    4: base.slice(1, 4),
    5: [base[3], base[4], base[0]].filter(Boolean),
    6: [],
  }
}

function BellIcon({ active }){
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M18 9a6 6 0 0 0-12 0c0 7-2.5 7-2.5 7h17S18 16 18 9Z"/>
    <path d="M10 20a2.4 2.4 0 0 0 4 0"/>
    {active ? <path d="M19.5 4.5 21 6l2-3"/> : null}
  </svg>
}

function readNotify(){
  try{ return JSON.parse(localStorage.getItem('anime:schedule-notify') || '{}') }catch{ return {} }
}

function writeNotify(value){
  localStorage.setItem('anime:schedule-notify', JSON.stringify(value))
}

export default function HomeScheduleWidgetClient({ schedule = [] }) {
  const [selectedDay, setSelectedDay] = useState(1)
  const [notify, setNotify] = useState(null)
  const byDay = useMemo(() => normalizeSchedule(schedule), [schedule])
  const items = byDay[selectedDay] || []

  useEffect(() => {
    setNotify(readNotify())
  }, [])

  function toggleNotify(event, item){
    event.preventDefault()
    event.stopPropagation()
    const current = notify || readNotify()
    const key = `${item.slug}-${item.time}`
    const next = { ...current, [key]: !current[key] }
    if(!next[key]) delete next[key]
    writeNotify(next)
    setNotify(next)
    pushToast(next[key] ? `Уведомление включено: ${item.title}` : `Уведомление отключено: ${item.title}`, 'success')
  }

  const actualNotify = notify || {}

  return (
    <div className="widget schedule schedule-reference">
      <div className="widget-head">
        <h3><span className="schedule-head-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="6" width="14" height="14" rx="2"/><path d="M8 3v5M16 3v5M5 11h14"/></svg></span>Расписание</h3>
        <Link href="/schedule">Вся неделя ›</Link>
      </div>

      <div className="days schedule-reference-days" role="tablist" aria-label="Дни недели">
        {dayLabels.map(([day, date], index) => (
          <button
            type="button"
            className={index === selectedDay ? 'sel' : ''}
            key={`${day}-${date}`}
            onClick={() => setSelectedDay(index)}
            aria-pressed={index === selectedDay}
          >
            <span>{day}</span>
            <b>{date}</b>
          </button>
        ))}
      </div>

      <div className="schedule-list schedule-reference-list">
        {items.length > 0 ? (
          items.map((item, index) => {
            const key = `${item.slug}-${item.time}`
            const active = Boolean(actualNotify[key])
            return <Link className="sch schedule-reference-item" href={`/anime/${item.slug}`} key={`${item.time}-${item.title}-${index}`}>
              <time>{item.time}</time>
              <img src={item.poster} alt="Аниме" />
              <div>
                <b>{item.title}</b>
                <span>{item.meta}</span>
              </div>
              <button
                type="button"
                className={active ? 'schedule-bell active' : 'schedule-bell'}
                onClick={(event)=>toggleNotify(event, item)}
                aria-label={active ? 'Отключить уведомление' : 'Включить уведомление'}
              >
                <BellIcon active={active}/>
              </button>
            </Link>
          })
        ) : (
          <div className="schedule-empty">
            <b>На этот день серий нет</b>
            <span>Проверь расписание позже или открой полный календарь.</span>
          </div>
        )}
      </div>

      <Link className="soft-link schedule-reference-link" href="/schedule">Смотреть расписание <span>→</span></Link>
    </div>
  )
}
