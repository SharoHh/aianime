'use client'

import { useEffect, useState } from 'react'
import { pushToast } from '@/components/ToastCenter'

function loadComments(){
  const result = []
  for(let i=0;i<localStorage.length;i++){
    const key = localStorage.key(i)
    if(!key?.startsWith('anime:comments:')) continue
    try{
      const slug = key.replace('anime:comments:', '')
      const items = JSON.parse(localStorage.getItem(key) || '[]')
      items.forEach(item => result.push({ ...item, slug, storageKey:key }))
    }catch{}
  }
  return result.sort((a,b)=>Number(b.id)-Number(a.id))
}

export default function AdminCommentsClient(){
  const [items,setItems] = useState([])

  useEffect(()=>setItems(loadComments()), [])

  function remove(comment){
    const list = JSON.parse(localStorage.getItem(comment.storageKey) || '[]').filter(x=>x.id!==comment.id)
    localStorage.setItem(comment.storageKey, JSON.stringify(list))
    setItems(loadComments())
    pushToast('Комментарий удалён', 'success')
  }

  if(!items.length) return <div className="empty-state">Комментариев пока нет.</div>

  return <section className="widget admin-edit-preview">
    <div className="admin-simple-list comment-admin-list">
      {items.map(item=><div key={`${item.storageKey}-${item.id}`}>
        <div><b>{item.author} · {item.slug}</b><span>{item.text}</span></div>
        <button onClick={()=>remove(item)}>Удалить</button>
      </div>)}
    </div>
  </section>
}
