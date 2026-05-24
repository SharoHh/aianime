'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { pushToast } from '@/components/ToastCenter'

function fallbackSlug(title, index){
  return title?.toLowerCase?.().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '') || `schedule-${index}`
}

function normalize(schedule = []){
  return schedule.map((item, index) => {
    const slug = item[4] || fallbackSlug(item[1], index)
    return {
      time:item[0],
      title:item[1],
      meta:item[2],
      poster:item[3] || '/posters/magic2.svg',
      slug,
      href:`/anime/${slug}`,
      notifyKey:`${slug}-${item[0]}`,
    }
  })
}

function flattenScheduleDays(scheduleDays = []){
  if(!Array.isArray(scheduleDays)) return []
  return scheduleDays.flatMap((day) => {
    const items = Array.isArray(day?.items) ? day.items : []
    return items.map((item) => ({
      ...item,
      dayName: day.name,
      dayDate: `${day.date} ${day.month}`,
      href: item.href || `/anime/${item.slug}`,
      notifyKey: item.notifyKey || `${item.slug}-${item.time}`,
    }))
  })
}

function readNotify(){
  try{ return JSON.parse(localStorage.getItem('anime:schedule-notify') || '{}') }catch{ return {} }
}

function writeNotify(value){
  localStorage.setItem('anime:schedule-notify', JSON.stringify(value))
  window.dispatchEvent(new Event('anime:user-updated'))
}

export default function NotificationsClient({ schedule = [], scheduleDays = null }){
  const [notify,setNotify] = useState({})
  const items = useMemo(()=>{
    const fromDays = flattenScheduleDays(scheduleDays)
    return fromDays.length ? fromDays : normalize(schedule)
  }, [schedule, scheduleDays])

  useEffect(()=>{
    setNotify(readNotify())
    const update = () => setNotify(readNotify())
    window.addEventListener('storage', update)
    window.addEventListener('anime:user-updated', update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener('anime:user-updated', update)
    }
  }, [])

  const active = items.filter(item => notify[item.notifyKey || `${item.slug}-${item.time}`])

  function remove(item){
    const key = item.notifyKey || `${item.slug}-${item.time}`
    const next = { ...notify }
    delete next[key]
    writeNotify(next)
    setNotify(next)
    pushToast(`Уведомление отключено: ${item.title}`, 'success')
  }

  function clearAll(){
    writeNotify({})
    setNotify({})
    pushToast('Все уведомления отключены', 'success')
  }

  if(!active.length){
    return <section className="widget notification-empty">
      <h2>Уведомлений пока нет</h2>
      <p>Открой расписание на главной и нажми колокольчик рядом с нужной серией.</p>
      <Link className="primary" href="/">На главную</Link>
    </section>
  }

  return <>
    <div className="notification-toolbar"><b>{active.length}</b><span>активных уведомлений</span><button onClick={clearAll}>Отключить все</button></div>
    <section className="notification-list">
      {active.map(item=><article className="notification-card widget" key={item.notifyKey || `${item.slug}-${item.time}`}>
        <img src={item.poster || '/posters/magic2.svg'} alt={item.title || 'Аниме'}/>
        <div><time>{item.dayName ? `${item.dayName}, ${item.time}` : item.time}</time><h3>{item.title}</h3><p>{item.meta}</p></div>
        <Link href={item.href || `/anime/${item.slug}`}>Открыть</Link>
        <button onClick={()=>remove(item)}>Отключить</button>
      </article>)}
    </section>
  </>
}
