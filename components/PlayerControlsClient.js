'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { pushToast } from '@/components/ToastCenter'

function key(slug, episode){ return `anime:watch-progress:${slug}:${episode}` }

export default function PlayerControlsClient({ slug, episode, nextEpisode, voice = 'default' }){
  const [progress,setProgress] = useState(0)
  const [paused,setPaused] = useState(true)
  const [autoNext,setAutoNext] = useState(true)
  const [theatre,setTheatre] = useState(false)

  useEffect(()=>{
    try{
      setProgress(Number(localStorage.getItem(key(slug, episode)) || 0))
      setAutoNext(localStorage.getItem('anime:auto-next') !== '0')
    }catch{}
  }, [slug, episode])

  useEffect(()=>{
    try{
      localStorage.setItem(key(slug, episode), String(progress))
      localStorage.setItem('anime:auto-next', autoNext ? '1' : '0')
    }catch{}
  }, [progress, autoNext, slug, episode])

  useEffect(()=>{
    const handler = (event) => {
      const keyName = String(event.key || '').toLowerCase()
      if(keyName === ' '){
        event.preventDefault()
        setPaused(v => {
          const next = !v
          pushToast(next ? 'Пауза' : 'Воспроизведение', 'info')
          return next
        })
      }
      if(keyName === 'arrowright') setProgress(v => Math.min(100, v + 5))
      if(keyName === 'arrowleft') setProgress(v => Math.max(0, v - 5))
      if(keyName === 't') setTheatre(v => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(()=>{
    if(paused) return
    const id = setInterval(()=>{
      setProgress(v => {
        const next = Math.min(100, v + 1)
        if(next >= 100 && autoNext) pushToast('Серия закончилась — можно открыть следующую', 'success')
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [paused, autoNext])

  return <div className={theatre ? 'player-ui-overlay theatre-on' : 'player-ui-overlay'}>
    {theatre ? <div className="watch-theatre-backdrop"/> : null}

    <div className="player-ui-top">
      <span>Пробел — пауза</span>
      <span>← → перемотка</span>
      <span>T — театр</span>
      <span>{voice}</span>
    </div>

    <div className="player-ui-bottom">
      <button type="button" onClick={()=>setPaused(v=>!v)}>{paused ? '▶' : 'Ⅱ'}</button>
      <div className="player-progress"><i style={{width:`${progress}%`}}/></div>
      <span>{progress}%</span>
      <button type="button" className={autoNext ? 'player-toggle active' : 'player-toggle'} onClick={()=>setAutoNext(v=>!v)}>Auto</button>
      <button type="button" className={theatre ? 'player-toggle active' : 'player-toggle'} onClick={()=>setTheatre(v=>!v)}>Театр</button>
      <Link href={`/anime/${slug}#player`}>Следующая</Link>
    </div>
  </div>
}
