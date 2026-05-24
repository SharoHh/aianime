'use client'

import { useEffect, useMemo, useState } from 'react'
import PlayerControlsClient from '@/components/PlayerControlsClient'

function playerEndpoint(slug, episode){
  const params = new URLSearchParams()
  params.set('slug', slug)
  params.set('episode', String(episode || 1))
  return `/api/player?${params.toString()}`
}

export default function KodikPlayerClient({ slug, title, banner, episode = 1, nextEpisode = 2, voice = 'Kodik', translationTitle = null, quality = null }){
  const [state, setState] = useState({ loading:true, ok:false, embedUrl:null, error:null, source:null })
  const src = useMemo(() => playerEndpoint(slug, episode), [slug, episode])

  useEffect(() => {
    let cancelled = false
    setState({ loading:true, ok:false, embedUrl:null, error:null, source:null })

    fetch(src, { cache:'no-store' })
      .then(res => res.json())
      .then(data => {
        if(cancelled) return
        setState({
          loading:false,
          ok:Boolean(data?.ok && data?.embedUrl),
          embedUrl:data?.embedUrl || null,
          error:data?.error || null,
          source:data?.source || null,
          voice:data?.voice || translationTitle || voice,
          quality:data?.quality || quality
        })
      })
      .catch(error => {
        if(cancelled) return
        setState({ loading:false, ok:false, embedUrl:null, error:error?.message || String(error), source:null })
      })

    return () => { cancelled = true }
  }, [src, translationTitle, voice, quality])

  if(state.ok && state.embedUrl){
    return <div className="compact-player compact-player-kodik is-ready">
      <iframe
        className="kodik-player-iframe"
        src={state.embedUrl}
        title={`${title} — серия ${episode}`}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="kodik-player-meta">
        <span>Источник: Kodik</span>
        <span>{state.voice || 'Озвучка подключена'}</span>
        {state.quality ? <span>{state.quality}</span> : null}
      </div>
    </div>
  }

  return <div className="compact-player compact-player-kodik is-fallback">
    <img src={banner} alt="Аниме"/>
    <div className="compact-player-shade"/>
    <div className="compact-player-center">
      <button type="button">{state.loading ? '…' : '▶'}</button>
      <h3>{title}</h3>
      <p>{state.loading ? 'Ищем доступный плеер Kodik…' : 'Плеер появится после Kodik-синхронизации'}</p>
      {!state.loading && state.error ? <small className="kodik-player-error">{state.error}</small> : null}
    </div>
    <PlayerControlsClient slug={slug} episode={episode} nextEpisode={nextEpisode} voice={state.voice || voice}/>
  </div>
}
