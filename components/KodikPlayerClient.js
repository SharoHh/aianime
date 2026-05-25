'use client'

import { useEffect, useMemo, useState } from 'react'
import PlayerControlsClient from '@/components/PlayerControlsClient'

function playerEndpoint(slug, episode){
  const params = new URLSearchParams()
  params.set('slug', slug)
  params.set('episode', String(episode || 1))
  return `/api/player?${params.toString()}`
}

function initialPlayerState({ initialEmbedUrl, initialVoice, initialQuality, initialSource, translationTitle, voice, quality }){
  const embedUrl = String(initialEmbedUrl || '').trim()
  if(embedUrl){
    return {
      loading:false,
      ok:true,
      embedUrl,
      error:null,
      source:initialSource || 'initial',
      voice:initialVoice || translationTitle || voice || 'Kodik',
      quality:initialQuality || quality || null
    }
  }
  return { loading:true, ok:false, embedUrl:null, error:null, source:null, voice:initialVoice || translationTitle || voice || 'Kodik', quality:initialQuality || quality || null }
}

export default function KodikPlayerClient({
  slug,
  title,
  banner,
  episode = 1,
  nextEpisode = 2,
  voice = 'Kodik',
  translationTitle = null,
  quality = null,
  initialEmbedUrl = null,
  initialVoice = null,
  initialQuality = null,
  initialSource = null,
  historyItem = null
}){
  const [state, setState] = useState(() => initialPlayerState({ initialEmbedUrl, initialVoice, initialQuality, initialSource, translationTitle, voice, quality }))
  const [iframeReady, setIframeReady] = useState(false)
  const [iframeSlow, setIframeSlow] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const src = useMemo(() => playerEndpoint(slug, episode), [slug, episode])

  useEffect(() => {
    let cancelled = false
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const hasInitialEmbed = Boolean(String(initialEmbedUrl || '').trim())

    setIframeSlow(false)
    setIframeReady(false)
    setState(initialPlayerState({ initialEmbedUrl, initialVoice, initialQuality, initialSource, translationTitle, voice, quality }))

    const revealTimer = setTimeout(() => {
      if(!cancelled && hasInitialEmbed) setIframeReady(true)
    }, 900)

    const requestTimeout = setTimeout(() => {
      try{ controller?.abort() }catch{}
    }, 8500)

    const slowIframeTimer = setTimeout(() => {
      if(!cancelled) setIframeSlow(true)
    }, 8000)

    fetch(src, { cache:'no-store', signal: controller?.signal })
      .then(res => res.json())
      .then(data => {
        if(cancelled) return
        const embedUrl = data?.embedUrl || initialEmbedUrl || null
        setState({
          loading:false,
          ok:Boolean(data?.ok && embedUrl),
          embedUrl,
          error:data?.error || null,
          source:data?.source || initialSource || null,
          voice:data?.voice || initialVoice || translationTitle || voice,
          quality:data?.quality || initialQuality || quality
        })
        if(embedUrl && !hasInitialEmbed) setIframeReady(false)
      })
      .catch(error => {
        if(cancelled) return
        if(initialEmbedUrl){
          setState(initialPlayerState({ initialEmbedUrl, initialVoice, initialQuality, initialSource, translationTitle, voice, quality }))
          setIframeReady(true)
          return
        }
        const message = error?.name === 'AbortError'
          ? 'Плеер долго отвечает. Обнови страницу или попробуй открыть позже.'
          : error?.message || String(error)
        setState({ loading:false, ok:false, embedUrl:null, error:message, source:null, voice:initialVoice || translationTitle || voice, quality:initialQuality || quality })
      })
      .finally(() => clearTimeout(requestTimeout))

    return () => {
      cancelled = true
      clearTimeout(revealTimer)
      clearTimeout(requestTimeout)
      clearTimeout(slowIframeTimer)
      try{ controller?.abort() }catch{}
    }
  }, [src, initialEmbedUrl, initialVoice, initialQuality, initialSource, translationTitle, voice, quality])

  useEffect(() => {
    if(!state.ok || !state.embedUrl || iframeReady) return undefined
    const id = setTimeout(() => setIframeReady(true), 3500)
    return () => clearTimeout(id)
  }, [state.ok, state.embedUrl, iframeReady])

  if(state.ok && state.embedUrl){
    return <div className={`compact-player compact-player-kodik is-ready ${iframeReady ? 'iframe-ready' : 'iframe-loading'} ${iframeSlow ? 'iframe-slow' : ''}`}>
      {!iframeReady ? <div className="kodik-iframe-skeleton">
        <div className="kodik-loader-orb" />
        <strong>Загружаем плеер Kodik…</strong>
        <span>{state.voice || translationTitle || voice || 'Подключаем озвучку'}</span>
      </div> : null}
      <iframe
        key={iframeKey}
        className="kodik-player-iframe"
        src={state.embedUrl}
        title={`${title} — серия ${episode}`}
        loading="eager"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        referrerPolicy="origin-when-cross-origin"
        onLoad={() => setIframeReady(true)}
      />
      {iframeSlow ? <div className="kodik-player-rescue">
        <strong>Kodik долго отвечает</strong>
        <span>Ссылка на плеер есть, но сам iframe может зависать из-за Kodik/сети/блокировщика.</span>
        <div>
          <button type="button" onClick={() => { setIframeSlow(false); setIframeReady(false); setIframeKey(key => key + 1); setTimeout(() => setIframeReady(true), 900); setTimeout(() => setIframeSlow(true), 8000) }}>Перезагрузить</button>
          <a href={state.embedUrl} target="_blank" rel="noreferrer">Открыть отдельно</a>
        </div>
      </div> : null}
      <div className="kodik-player-meta">
        <span>Источник: Kodik</span>
        <span>{state.voice || 'Озвучка подключена'}</span>
        {state.quality ? <span>{state.quality}</span> : null}
        <button type="button" onClick={() => { setIframeSlow(false); setIframeReady(false); setIframeKey(key => key + 1); setTimeout(() => setIframeReady(true), 900); setTimeout(() => setIframeSlow(true), 8000) }}>Обновить плеер</button>
        <a href={state.embedUrl} target="_blank" rel="noreferrer">Открыть отдельно</a>
      </div>
    </div>
  }

  return <div className="compact-player compact-player-kodik is-fallback">
    <img src={banner} alt="Аниме"/>
    <div className="compact-player-shade"/>
    <div className="compact-player-center">
      <button type="button" className={state.loading ? 'player-loading-button' : ''}>{state.loading ? '…' : '▶'}</button>
      <h3>{title}</h3>
      <p>{state.loading ? 'Ищем доступный плеер Kodik…' : 'Плеер появится после Kodik-синхронизации'}</p>
      {state.loading ? <div className="player-progress-dots"><i/><i/><i/></div> : null}
      {!state.loading && state.error ? <small className="kodik-player-error">{state.error}</small> : null}
    </div>
    <PlayerControlsClient slug={slug} episode={episode} nextEpisode={nextEpisode} voice={state.voice || voice} historyItem={historyItem}/>
  </div>
}
