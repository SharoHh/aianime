'use client'

import { useEffect, useState } from 'react'
import { pushToast } from '@/components/ToastCenter'

const empty = { title:'', description:'', color:'pink' }

function read(initial){
  try{
    const saved = JSON.parse(localStorage.getItem('anime:admin-collections') || 'null')
    if(saved) return saved
  }catch{}
  return initial
}

export default function AdminCollectionsClient({ initial = [] }){
  const [items,setItems] = useState([])
  const [form,setForm] = useState(empty)

  useEffect(()=>setItems(read(initial)), [initial])

  function saveList(next){
    setItems(next)
    localStorage.setItem('anime:admin-collections', JSON.stringify(next))
    pushToast('Подборки сохранены локально', 'success')
  }

  function add(){
    if(!form.title) return pushToast('Укажи название', 'error')
    saveList([{...form}, ...items])
    setForm(empty)
  }

  return <section className="admin-grid">
    <div className="widget admin-edit-preview">
      <div className="admin-preview-grid editable-admin-grid">
        <label><span>Название</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
        <label><span>Цвет</span><input value={form.color} onChange={e=>setForm({...form,color:e.target.value})}/></label>
        <label className="wide"><span>Описание</span><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
      </div>
      <div className="admin-actions-row"><button className="primary" onClick={add}>Добавить подборку</button></div>
    </div>
    <div className="widget admin-edit-preview">
      <div className="widget-head"><h3>Подборки</h3><span>{items.length}</span></div>
      <div className="admin-collection-preview">{items.map((item,i)=><article key={`${item.title}-${i}`}>
        <b>{item.title}</b><p>{item.description || item.subtitle}</p><button onClick={()=>saveList(items.filter((_,index)=>index!==i))}>Удалить</button>
      </article>)}</div>
    </div>
  </section>
}
