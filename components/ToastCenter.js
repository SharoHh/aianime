'use client'

import { useEffect, useState } from 'react'

let externalPush = null

export function pushToast(message, type = 'info'){
  if(externalPush) externalPush(message, type)
}

export default function ToastCenter(){
  const [items,setItems] = useState([])

  useEffect(()=>{
    externalPush = (message, type = 'info') => {
      const id = Date.now() + Math.random()
      setItems(list => [...list, { id, message, type }].slice(-4))
      setTimeout(()=>setItems(list => list.filter(x => x.id !== id)), 3200)
    }
    return () => { externalPush = null }
  }, [])

  if(!items.length) return null

  return <div className="toast-center">
    {items.map(item => <div className={`toast toast-${item.type}`} key={item.id}>
      <b>{item.type === 'success' ? 'Готово' : item.type === 'error' ? 'Ошибка' : 'Уведомление'}</b>
      <span>{item.message}</span>
    </div>)}
  </div>
}
