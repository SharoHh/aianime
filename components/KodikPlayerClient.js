'use client'

import { useEffect, useMemo, useState } from 'react'

function playerEndpoint(slug, episode){
  const params = new URLSearchParams()
  params.set('slug', slug)
  params.set('episode', String(episode || 1))
  return `/api/player?${params.toString()}`
}

function normalizePlayerState({ initialEmbedUrl, initialVoice, initialQuality, initialSource, translationTitle, voice, quality }){
  const embedUrl = String(initialEmbedUrl || '').trim()
  return {
    loading: !embedUrl,
    ok: Boolean(embedUrl),
    embedUrl: embedUrl || null,
    error: null,
    source: initialSource || (embedUrl ? 'initial' : null),
    voice: initialVoice || translationTitle || voice || 'Kodik',
    quality: initialQuality || quality || null
  }
}

export default function KodikPlayerClient({
  slug,
  title,
  banner,
  episode = 1,
  voice = 'Kodik',
  translationTitle = null,
  quality = null,
  initialEmbedUrl = null,
  initialVoice = null,
  initialQuality = null,
  initialSource = null
}){
  const [state, setState] = useState(() => normalizePlayerState({ initialEmbedUrl, initialVoice, initialQuality, initialSource, translationTitle, voice, quality }))
  const src = useMemo(() => playerEndpoint(slug, episode), [slug, episode])

  useEffect(() => {
    let cancelled = false
    const initialState = normalizePlayerState({ initialEmbedUrl, initialVoice, initialQuality, initialSource, translationTitle, voice, quality })
    setState(initialState)

    // Если сервер уже дал embedUrl из anime_episodes, iframe показываем сразу.
    // Никаких оверлеев, псевдо-контролов и rescue-плашек поверх Kodik не рисуем.
    if(initialState.embedUrl) return () => { cancelled = true }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timeout = setTimeout(() => {
      try{ controller?.abort() }catch{}
    }, 6500)

    fetch(src, { cache:'no-store', signal:controller?.signal })
      .then(res => res.json())
      .then(data => {
        if(cancelled) return
        const embedUrl = String(data?.embedUrl || '').trim()
        setState({
          loading:false,
          ok:Boolean(data?.ok && embedUrl),
          embedUrl:embedUrl || null,
          error:data?.error || null,
          source:data?.source || null,
          voice:data?.voice || initialVoice || translationTitle || voice || 'Kodik',
          quality:data?.quality || initialQuality || quality || null
        })
      })
      .catch(error => {
        if(cancelled) return
        setState({
          loading:false,
          ok:false,
          embedUrl:null,
          error:error?.name === 'AbortError' ? 'Плеер пока не ответил.' : (error?.message || 'Плеер временно недоступен.'),
          source:null,
          voice:initialVoice || translationTitle || voice || 'Kodik',
          quality:initialQuality || quality || null
        })
      })
      .finally(() => clearTimeout(timeout))

    return () => {
      cancelled = true
      clearTimeout(timeout)
      try{ controller?.abort() }catch{}
    }
  }, [src, initialEmbedUrl, initialVoice, initialQuality, initialSource, translationTitle, voice, quality])

  if(state.ok && state.embedUrl){
    return <div className="compact-player compact-player-kodik is-ready is-clean">
      <iframe
        key={`${slug}-${episode}-${state.embedUrl}`}
        className="kodik-player-iframe"
        src={state.embedUrl}
        title={`${title} — серия ${episode}`}
        loading="eager"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        referrerPolicy="origin-when-cross-origin"
      />
    </div>
  }

  return <div className="compact-player compact-player-kodik is-fallback is-clean">
    <img src={banner} alt="Аниме"/>
    <div className="compact-player-shade"/>
    <div className="compact-player-center kodik-player-simple-fallback">
      <h3>{title}</h3>
      <p>{state.loading ? 'Загружаем плеер…' : 'Плеер временно недоступен'}</p>
      {!state.loading && state.error ? <small className="kodik-player-error">{state.error}</small> : null}
    </div>
  </div>
}
