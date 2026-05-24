'use client'

import { useEffect, useState } from 'react'
import { pushToast } from '@/components/ToastCenter'

const empty = { time:'', title:'', meta:'', poster:'', slug:'' }

function read(initial){
  try{
    const saved = JSON.parse(localStorage.getItem('anime:admin-schedule') || 'null')
    if(saved) return saved
  }catch{}
  return initial.map((x,i)=>({ time:x[0], title:x[1], meta:x[2], poster:x[3], slug:x[4] || `schedule-${i}` }))
}

export default function AdminScheduleClient({ initial = [] }){
  const [items,setItems] = useState([])
  const [form,setForm] = useState(empty)

  useEffect(()=>setItems(read(initial)), [initial])

  function saveList(next){
    setItems(next)
    localStorage.setItem('anime:admin-schedule', JSON.stringify(next))
    pushToast('Расписание сохранено локально', 'success')
  }

  function add(){
    if(!form.title || !form.time) return pushToast('Укажи время и название', 'error')
    saveList([{...form, slug:form.slug || form.title.toLowerCase().replace(/[^a-zа-яё0-9]+/gi,'-')}, ...items])
    setForm(empty)
  }

  function remove(index){
    saveList(items.filter((_,i)=>i!==index))
  }

  return <section className="admin-grid">
    <div className="widget admin-edit-preview">
      <div className="admin-preview-grid editable-admin-grid">
        {Object.keys(empty).map(key=><label key={key}><span>{key}</span><input value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}
      </div>
      <div className="admin-actions-row"><button className="primary" onClick={add}>Добавить выпуск</button></div>
      <p className="admin-muted">Сейчас сохраняется локально. Следующим шагом можно подключить таблицу Supabase schedule.</p>
    </div>
    <div className="widget admin-edit-preview">
      <div className="widget-head"><h3>Текущие выпуски</h3><span>{items.length}</span></div>
      <div className="admin-simple-list">{items.map((item,i)=><div key={`${item.time}-${item.title}-${i}`}>
        <img src={item.poster || '/posters/magic2.svg'}/>
        <div><b>{item.time} · {item.title}</b><span>{item.meta}</span></div>
        <button onClick={()=>remove(i)}>Удалить</button>
      </div>)}</div>
    </div>
  </section>
}
