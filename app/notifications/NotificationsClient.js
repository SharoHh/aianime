'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { pushToast } from '@/components/ToastCenter'

function normalize(schedule = []){
  return schedule.map((item, index) => ({
    time:item[0],
    title:item[1],
    meta:item[2],
    poster:item[3],
    slug:item[4] || item[1]?.toLowerCase?.().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '') || `schedule-${index}`,
  }))
}

function readNotify(){
  try{ return JSON.parse(localStorage.getItem('anime:schedule-notify') || '{}') }catch{ return {} }
}

function writeNotify(value){
  localStorage.setItem('anime:schedule-notify', JSON.stringify(value))
  window.dispatchEvent(new Event('anime:user-updated'))
}

export default function NotificationsClient({ schedule = [] }){
  const [notify,setNotify] = useState({})
  const items = useMemo(()=>normalize(schedule), [schedule])

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

  const active = items.filter(item => notify[`${item.slug}-${item.time}`])

  function remove(item){
    const key = `${item.slug}-${item.time}`
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
      {active.map(item=><article className="notification-card widget" key={`${item.slug}-${item.time}`}>
        <img src={item.poster} alt="Аниме"/>
        <div><time>{item.time}</time><h3>{item.title}</h3><p>{item.meta}</p></div>
        <Link href={`/anime/${item.slug}`}>Открыть</Link>
        <button onClick={()=>remove(item)}>Отключить</button>
      </article>)}
    </section>
  </>
}
