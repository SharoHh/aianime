'use client'

import { useEffect, useState } from 'react'
import { pushToast } from '@/components/ToastCenter'

function key(slug){ return `anime:comments:${slug}` }

function read(slug){
  try{ return JSON.parse(localStorage.getItem(key(slug)) || '[]') }catch{ return [] }
}

function write(slug, list){
  localStorage.setItem(key(slug), JSON.stringify(list))
}

export default function CommentsClient({ slug, title }){
  const [items,setItems] = useState([])
  const [text,setText] = useState('')

  useEffect(()=>setItems(read(slug)), [slug])

  function submit(e){
    e.preventDefault()
    const clean = text.trim()
    if(!clean) return
    const next = [{
      id: Date.now(),
      author: 'Haruno',
      text: clean,
      createdAt: new Date().toISOString(),
      likes: 0
    }, ...items].slice(0,30)
    setItems(next)
    write(slug, next)
    setText('')
    pushToast('Комментарий добавлен', 'success')
  }

  function like(id){
    const next = items.map(item => item.id === id ? { ...item, likes: (item.likes || 0) + 1 } : item)
    setItems(next)
    write(slug, next)
  }

  return <section className="widget comments-box">
    <div className="widget-head"><h3>Комментарии</h3><span>{items.length}</span></div>
    <form className="comment-form" onSubmit={submit}>
      <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={`Поделись мнением о “${title}”...`}/>
      <button className="primary">Отправить</button>
    </form>

    <div className="comment-list">
      {items.length ? items.map(item => <article className="comment" key={item.id}>
        <div className="comment-avatar">H</div>
        <div>
          <header><b>{item.author}</b><span>{new Date(item.createdAt).toLocaleDateString('ru-RU')}</span></header>
          <p>{item.text}</p>
          <button onClick={()=>like(item.id)}>♡ {item.likes || 0}</button>
        </div>
      </article>) : <div className="comments-empty">Комментариев пока нет. Будь первым.</div>}
    </div>
  </section>
}
