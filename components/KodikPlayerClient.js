'use client'

import { useEffect, useMemo, useState } from 'react'
import { saveHistoryItem } from '@/lib/userStorage'
import { useAuthState } from '@/components/AuthStateClient'

function playerEndpoint(slug, episode, voice){
  const params = new URLSearchParams({ slug:String(slug || ''), episode:String(episode || 1) })
  if(voice) params.set('voice', voice)
  return `/api/player?${params.toString()}`
}

function optionsEndpoint(slug){
  const params = new URLSearchParams({ slug:String(slug || ''), refresh:'1' })
  return `/api/player/options?${params.toString()}`
}

function cleanVoice(value){
  const text = String(value || '').trim()
  if(!text || text.toLowerCase() === 'default') return 'Kodik'
  return text
}

function normalizeOption(option){
  const episodeNumber = Math.max(1, Number(option?.episodeNumber || option?.episode_number || 1) || 1)
  const embedUrl = String(option?.embedUrl || option?.embed_url || '').trim()
  return {
    id: option?.id || `${cleanVoice(option?.voice)}-${episodeNumber}-${embedUrl}`,
    episodeNumber,
    title: option?.title || `Серия ${episodeNumber}`,
    provider: option?.provider || 'kodik',
    voice: cleanVoice(option?.voice || option?.translationTitle || option?.translation_title),
    embedUrl,
    status: option?.status || 'published',
    source: option?.source || 'anime_episodes',
    quality: option?.quality || null,
    translationType: option?.translationType || option?.translation_type || null,
    translationId: option?.translationId || option?.translation_id || null,
    seasonNumber: option?.seasonNumber || option?.season_number || null,
  }
}

function usable(option){
  return Boolean(option?.embedUrl) && option.status !== 'placeholder' && option.source !== 'fallback'
}

function normalizeOptions(options = []){
  const map = new Map()
  for(const raw of options || []){
    const option = normalizeOption(raw)
    if(!usable(option)) continue
    const key = `${option.provider}:${option.voice}:${option.episodeNumber}`
    const current = map.get(key)
    const score = (option.source === 'kodik-api-episode' ? 10 : 0) + (option.embedUrl ? 5 : 0)
    const currentScore = current ? (current.source === 'kodik-api-episode' ? 10 : 0) + (current.embedUrl ? 5 : 0) : -1
    if(!current || score >= currentScore) map.set(key, option)
  }
  const rows = Array.from(map.values())
  const uniqueUrls = new Set(rows.map(item => item.embedUrl))
  const uniqueEpisodes = new Set(rows.map(item => item.episodeNumber))

  // Защита от старой базы: если много серий указывают на один и тот же Kodik serial iframe,
  // это не родной список серий, а старая синтетическая раскладка. Не показываем её.
  if(rows.length > 1 && uniqueUrls.size === 1 && uniqueEpisodes.size > 1){
    return [rows[0]]
  }

  return rows.sort((a,b) => {
    const voice = a.voice.localeCompare(b.voice, 'ru')
    if(voice) return voice
    return a.episodeNumber - b.episodeNumber
  })
}

function groupByVoice(options){
  const map = new Map()
  for(const option of options){
    const key = option.voice || 'Kodik'
    if(!map.has(key)) map.set(key, [])
    map.get(key).push(option)
  }
  return Array.from(map.entries()).map(([voice, episodes]) => ({
    voice,
    episodes: episodes.sort((a,b) => a.episodeNumber - b.episodeNumber),
    count: new Set(episodes.map(item => item.episodeNumber)).size,
    type: episodes.find(item => item.translationType)?.translationType || null,
    quality: episodes.find(item => item.quality)?.quality || null,
  })).sort((a,b) => b.count - a.count || a.voice.localeCompare(b.voice, 'ru'))
}

function pickInitialOption(options, episode, voice){
  if(!options.length) return null
  const targetEpisode = Math.max(1, Number(episode || 1) || 1)
  const targetVoice = cleanVoice(voice)
  return options.find(item => item.voice === targetVoice && item.episodeNumber === targetEpisode)
    || options.find(item => item.episodeNumber === targetEpisode)
    || options.find(item => item.voice === targetVoice)
    || options[0]
}

function normalizePlayerState({ initialEmbedUrl, initialVoice, initialQuality, initialSource, translationTitle, voice, quality }){
  const embedUrl = String(initialEmbedUrl || '').trim()
  return {
    loading: !embedUrl,
    ok: Boolean(embedUrl),
    embedUrl: embedUrl || null,
    error: null,
    source: initialSource || (embedUrl ? 'initial' : null),
    voice: cleanVoice(initialVoice || translationTitle || voice || 'Kodik'),
    quality: initialQuality || quality || null
  }
}

function updateUrl(slug, episode, voice){
  if(typeof window === 'undefined') return
  try{
    const url = new URL(window.location.href)
    url.pathname = `/anime/${encodeURIComponent(slug)}`
    url.searchParams.set('episode', String(episode || 1))
    if(voice) url.searchParams.set('voice', voice)
    url.hash = 'player'
    window.history.replaceState(null, '', url.toString())
  }catch{}
}

export default function KodikPlayerClient({
  slug,
  title,
  banner,
  episode = 1,
  selectedVoice = 'Kodik',
  voice = 'Kodik',
  translationTitle = null,
  quality = null,
  playerOptions = [],
  initialEmbedUrl = null,
  initialVoice = null,
  initialQuality = null,
  initialSource = null,
  historyItem = null
}){
  const { user } = useAuthState()
  const [options, setOptions] = useState(() => normalizeOptions(playerOptions))
  const [isRefreshingOptions, setIsRefreshingOptions] = useState(false)
  const [optionWarning, setOptionWarning] = useState('')
  const [selected, setSelected] = useState(() => pickInitialOption(normalizeOptions(playerOptions), episode, selectedVoice))
  const [state, setState] = useState(() => normalizePlayerState({ initialEmbedUrl, initialVoice, initialQuality, initialSource, translationTitle, voice, quality }))

  const voices = useMemo(() => groupByVoice(options), [options])
  const activeVoice = selected?.voice || cleanVoice(selectedVoice || state.voice || voice)
  const activeEpisodes = voices.find(item => item.voice === activeVoice)?.episodes || options.filter(item => item.voice === activeVoice)
  const activeEpisodeNumber = Number(selected?.episodeNumber || episode || 1)
  const currentEmbedUrl = selected?.embedUrl || state.embedUrl || initialEmbedUrl || null
  const currentQuality = selected?.quality || state.quality || quality || null
  const canUseNativeSelector = voices.length > 0 && options.length > 1

  useEffect(() => {
    const normalized = normalizeOptions(playerOptions)
    setOptions(normalized)
    setSelected(pickInitialOption(normalized, episode, selectedVoice))
  }, [slug, episode, selectedVoice, JSON.stringify(playerOptions)])

  useEffect(() => {
    let cancelled = false
    const current = pickInitialOption(options, episode, selectedVoice)
    if(current){
      setSelected(current)
      setState({ loading:false, ok:true, embedUrl:current.embedUrl, error:null, source:current.source, voice:current.voice, quality:current.quality || quality || null })
      return () => { cancelled = true }
    }

    const initialState = normalizePlayerState({ initialEmbedUrl, initialVoice, initialQuality, initialSource, translationTitle, voice, quality })
    setState(initialState)
    if(initialState.embedUrl) return () => { cancelled = true }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const endpoint = playerEndpoint(slug, episode, selectedVoice || voice)
    fetch(endpoint, { cache:'no-store', signal:controller?.signal })
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
          voice:cleanVoice(data?.voice || initialVoice || translationTitle || voice || 'Kodik'),
          quality:data?.quality || initialQuality || quality || null
        })
      })
      .catch(error => {
        if(cancelled) return
        setState({
          loading:false,
          ok:false,
          embedUrl:null,
          error:error?.message || 'Плеер временно недоступен.',
          source:null,
          voice:cleanVoice(initialVoice || translationTitle || voice || 'Kodik'),
          quality:initialQuality || quality || null
        })
      })

    return () => {
      cancelled = true
      try{ controller?.abort() }catch{}
    }
  }, [slug, episode, selectedVoice, options, initialEmbedUrl, initialVoice, initialQuality, initialSource, translationTitle, voice, quality])

  useEffect(() => {
    const uniqueUrls = new Set(options.map(item => item.embedUrl).filter(Boolean))
    const uniqueEpisodes = new Set(options.map(item => item.episodeNumber))
    const shouldRefresh = !options.length || (options.length === 1 && uniqueUrls.size <= 1) || (uniqueUrls.size === 1 && uniqueEpisodes.size <= 1)
    if(!slug || !shouldRefresh) return

    let cancelled = false
    setIsRefreshingOptions(true)
    setOptionWarning('')

    fetch(optionsEndpoint(slug), { cache:'no-store' })
      .then(res => res.json())
      .then(data => {
        if(cancelled) return
        const next = normalizeOptions(data?.options || [])
        if(next.length){
          setOptions(next)
          const picked = pickInitialOption(next, activeEpisodeNumber, activeVoice)
          if(picked){
            setSelected(picked)
            setState({ loading:false, ok:true, embedUrl:picked.embedUrl, error:null, source:picked.source, voice:picked.voice, quality:picked.quality || quality || null })
          }
        }
        if(data?.warning) setOptionWarning(String(data.warning))
      })
      .catch(error => {
        if(!cancelled) setOptionWarning(error?.message || 'Не удалось обновить список озвучек')
      })
      .finally(() => {
        if(!cancelled) setIsRefreshingOptions(false)
      })

    return () => { cancelled = true }
  }, [slug])

  useEffect(() => {
    if(!user?.id || !historyItem?.slug) return
    saveHistoryItem({ ...historyItem, voice:activeVoice, provider:'kodik' }, activeEpisodeNumber, 0)
  }, [user?.id, historyItem?.slug, activeEpisodeNumber, activeVoice])

  const chooseOption = (option) => {
    if(!option?.embedUrl) return
    setSelected(option)
    setState({ loading:false, ok:true, embedUrl:option.embedUrl, error:null, source:option.source, voice:option.voice, quality:option.quality || null })
    updateUrl(slug, option.episodeNumber, option.voice)
    if(historyItem?.slug) saveHistoryItem({ ...historyItem, voice:option.voice, provider:'kodik' }, option.episodeNumber, 0)
  }

  const chooseVoice = (voiceName) => {
    const list = voices.find(item => item.voice === voiceName)?.episodes || []
    const sameEpisode = list.find(item => item.episodeNumber === activeEpisodeNumber)
    chooseOption(sameEpisode || list[0])
  }

  const nextEpisode = activeEpisodes.find(item => item.episodeNumber > activeEpisodeNumber) || null

  return <div className="native-kodik-shell">
    <div className="native-kodik-panel" id="episodes">
      <div className="native-kodik-topline">
        <div>
          <b>Озвучка и серии</b>
          <span>{canUseNativeSelector ? `${voices.length} озвучек · ${activeEpisodes.length} серий в выбранной` : isRefreshingOptions ? 'Подтягиваем список из Kodik…' : 'Kodik'}</span>
        </div>
        {currentQuality ? <em>{currentQuality}</em> : null}
      </div>

      {voices.length > 1 ? <div className="native-voice-row" aria-label="Выбор озвучки">
        {voices.map(item => <button
          key={item.voice}
          type="button"
          className={item.voice === activeVoice ? 'active' : ''}
          onClick={() => chooseVoice(item.voice)}
        >
          <span>{item.voice}</span>
          <small>{item.count} сер.</small>
        </button>)}
      </div> : null}

      {canUseNativeSelector ? <>
        <div className="native-episode-row" aria-label="Выбор серии">
          {activeEpisodes.map(option => <button
            key={`${option.voice}-${option.episodeNumber}`}
            type="button"
            className={option.episodeNumber === activeEpisodeNumber ? 'active' : ''}
            onClick={() => chooseOption(option)}
          >
            {option.episodeNumber}
          </button>)}
        </div>
        <div className="native-player-actions">
          <span>Серия <b>{activeEpisodeNumber}</b>{activeVoice ? ` · ${activeVoice}` : ''}</span>
          {nextEpisode ? <button type="button" onClick={() => chooseOption(nextEpisode)}>Следующая →</button> : <span>Последняя серия</span>}
        </div>
      </> : <div className="native-kodik-note">
        {isRefreshingOptions ? 'Ищем доступные озвучки и отдельные ссылки серий. Плеер уже можно запускать.' : 'Если список серий не появился, переключай серии внутри Kodik-плеера.'}
      </div>}

      {optionWarning ? <div className="native-kodik-warning">{optionWarning}</div> : null}
    </div>

    {state.ok && currentEmbedUrl ? <div className="compact-player compact-player-kodik is-ready is-clean native-kodik-frame">
      <iframe
        key={`${slug}-${activeVoice}-${activeEpisodeNumber}-${currentEmbedUrl}`}
        className="kodik-player-iframe"
        src={currentEmbedUrl}
        title={`${title} — серия ${activeEpisodeNumber}`}
        loading="eager"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        referrerPolicy="origin-when-cross-origin"
      />
    </div> : <div className="compact-player compact-player-kodik is-fallback is-clean native-kodik-frame">
      <img src={banner} alt="Аниме"/>
      <div className="compact-player-shade"/>
      <div className="compact-player-center kodik-player-simple-fallback">
        <h3>{title}</h3>
        <p>{state.loading ? 'Загружаем плеер…' : 'Плеер временно недоступен'}</p>
        {!state.loading && state.error ? <small className="kodik-player-error">{state.error}</small> : null}
      </div>
    </div>}
  </div>
}
