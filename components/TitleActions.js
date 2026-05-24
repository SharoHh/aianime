'use client'

import { useEffect, useState } from 'react'
import { getFavorites, saveHistoryItem, toggleFavoriteItem } from '@/lib/userStorage'
import { pushToast } from '@/components/ToastCenter'

export default function TitleActions({ item }){
  const [favorite,setFavorite] = useState(false)
  const [saved,setSaved] = useState(false)

  useEffect(()=>{
    const update = () => setFavorite(getFavorites().some(x => x.slug === item.slug))
    update()
    window.addEventListener('storage', update)
    window.addEventListener('anime:user-updated', update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener('anime:user-updated', update)
    }
  }, [item.slug])

  function toggleFavorite(){
    const next = toggleFavoriteItem(item)
    setFavorite(next)
    pushToast(next ? 'Добавлено в избранное' : 'Удалено из избранного', 'success')
  }

  function addHistory(){
    saveHistoryItem(item, 1, 8)
    setSaved(true)
    pushToast('Добавлено в историю', 'success')
    setTimeout(()=>setSaved(false), 1600)
  }

  return <>
    <button className="secondary" onClick={toggleFavorite}>{favorite ? '♥ В избранном' : '♡ В избранное'}</button>
    <button className="secondary" onClick={addHistory}>{saved ? '✓ Добавлено' : '◷ В историю'}</button>
  </>
}
