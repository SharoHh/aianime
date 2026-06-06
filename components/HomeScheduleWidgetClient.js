'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { pushToast } from '@/components/ToastCenter'

const legacyDayLabels = [
  ['Пн', '1'],
  ['Вт', '2'],
  ['Ср', '3'],
  ['Чт', '4'],
  ['Пт', '5'],
  ['Сб', '6'],
  ['Вс', '7'],
]

function fallbackSlug(title, index){
  return title?.toLowerCase?.().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '') || `schedule-${index}`
}

function legacyScheduleToDays(schedule = []){
  const base = schedule.map((item, index) => {
    const slug = item[4] || fallbackSlug(item[1], index)
    return {
      time: item[0],
      title: item[1],
      meta: item[2],
      poster: item[3] || '/posters/magic2.svg',
      slug,
      href: `/anime/${slug}`,
      notifyKey: `${slug}-${item[0]}`,
    }
  })

  const legacyByDay = {
    0: [base[0], base[3]].filter(Boolean),
    1: base.slice(0, 3),
    2: [base[1], base[4], base[2]].filter(Boolean),
    3: [base[2], base[0], base[4]].filter(Boolean),
    4: base.slice(1, 4),
    5: [base[3], base[4], base[0]].filter(Boolean),
    6: [],
  }

  return legacyDayLabels.map(([shortName, date], index) => ({
    key: `legacy-${index}`,
    shortName,
    date,
    isToday: index === 0,
    items: legacyByDay[index] || [],
  }))
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
  window.dispatchEvent(new Event('anime:user-updated'))
}

export default function HomeScheduleWidgetClient({ schedule = [], scheduleDays = null, initialDay = 0 }) {
  const preparedDays = useMemo(() => {
    return Array.isArray(scheduleDays) && scheduleDays.length ? scheduleDays : legacyScheduleToDays(schedule)
  }, [schedule, scheduleDays])
  const safeInitialDay = Math.max(0, Math.min(preparedDays.length - 1, Number(initialDay) || 0))
  const [selectedDay, setSelectedDay] = useState(safeInitialDay)
  const [notify, setNotify] = useState(null)
  const currentDay = preparedDays[selectedDay] || preparedDays[0] || { items: [] }
  const items = currentDay.items || []
  const allWeekEmpty = preparedDays.every((day) => !Array.isArray(day?.items) || day.items.length === 0)

  useEffect(() => {
    setNotify(readNotify())
  }, [])

  useEffect(() => {
    if(selectedDay >= preparedDays.length) setSelectedDay(0)
  }, [preparedDays.length, selectedDay])

  function toggleNotify(event, item){
    event.preventDefault()
    event.stopPropagation()
    const current = notify || readNotify()
    const key = item.notifyKey || `${item.slug}-${item.time}`
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
        {preparedDays.map((day, index) => (
          <button
            type="button"
            className={index === selectedDay ? 'sel' : ''}
            key={day.key || `${day.shortName}-${day.date}`}
            onClick={() => setSelectedDay(index)}
            aria-pressed={index === selectedDay}
          >
            <span>{day.shortName}</span>
            <b>{day.date}</b>
          </button>
        ))}
      </div>

      <div className="schedule-list schedule-reference-list">
        {items.length > 0 ? (
          items.map((item, index) => {
            const key = item.notifyKey || `${item.slug}-${item.time}`
            const active = Boolean(actualNotify[key])
            return <Link className="sch schedule-reference-item" href={item.href || `/anime/${item.slug}`} key={`${key}-${index}`}>
              <time>{item.time}</time>
              <img loading="lazy" decoding="async" width="72" height="102" src={item.poster || '/posters/magic2.svg'} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'} />
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
            <b>{allWeekEmpty ? 'Расписание обновляется' : 'На этот день серий нет'}</b>
            <span>{allWeekEmpty ? 'После cron-синхронизации здесь появятся реальные эфиры.' : 'Проверь расписание позже или открой полный календарь.'}</span>
          </div>
        )}
      </div>

      <Link className="soft-link schedule-reference-link" href="/schedule">Смотреть расписание <span>→</span></Link>
    </div>
  )
}
