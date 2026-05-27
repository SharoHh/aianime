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
    episodesCount: Number(option?.episodesCount || option?.episodes_count || option?.raw?.episodes_count || option?.raw?.last_episode || 0) || null,
    groupedEpisodeCount: Number(option?.groupedEpisodeCount || option?.grouped_episode_count || option?.syntheticEpisodesCount || 0) || null,
    episodeNumbers: Array.isArray(option?.episodeNumbers) ? option.episodeNumbers.map(Number).filter(Number.isFinite) : [],
    materialType: option?.materialType || option?.material_type || option?.raw?.material_type || null,
    matchScore: Number(option?.matchScore || option?.match_score || option?.raw?.match_score || 0) || null,
  }
}

function usable(option){
  return Boolean(option?.embedUrl) && option.status !== 'placeholder' && option.source !== 'fallback'
}

function isSerialLikeOption(option = {}){
  const type = String(option?.materialType || option?.raw?.material_type || '').toLowerCase()
  const url = String(option?.embedUrl || option?.embed_url || '').toLowerCase()
  return type.includes('serial') || /\/(serial|seria)\//i.test(url)
}

function addEpisodeParamToUrl(value, episodeNumber){
  const raw = String(value || '').trim()
  const episode = Math.max(1, Number(episodeNumber) || 1)
  if(!raw) return ''
  try{
    const url = new URL(raw)
    url.searchParams.set('episode', String(episode))
    url.searchParams.set('seria', String(episode))
    return url.toString()
  }catch{
    return raw
  }
}

function optionEpisodeLimit(option, expectedEpisodes = 0){
  const expected = Math.max(0, Number(expectedEpisodes || 0) || 0)
  const declared = Math.max(0, Number(option?.episodesCount || option?.raw?.episodes_count || option?.raw?.last_episode || 0) || 0)
  const grouped = Math.max(0, Number(option?.groupedEpisodeCount || option?.syntheticEpisodesCount || 0) || 0)
  const numbers = Array.isArray(option?.episodeNumbers) ? option.episodeNumbers.map(Number).filter(Number.isFinite) : []
  const maxFromNumbers = numbers.length ? Math.max(...numbers) : 0
  const countFromNumbers = numbers.length ? new Set(numbers).size : 0
  const inferred = Math.max(grouped, maxFromNumbers, countFromNumbers)
  const limit = Math.max(expected > 1 ? expected : 0, declared, inferred)
  if(!Number.isFinite(limit) || limit <= 1) return 1
  return Math.min(Math.floor(limit), 800)
}

function makeSyntheticEpisodeOption(option, episodeNumber, expectedEpisodes = 0){
  const episode = Math.max(1, Number(episodeNumber) || 1)
  const limit = optionEpisodeLimit(option, expectedEpisodes)
  if(!option || !option.embedUrl || limit <= 1 || episode > limit) return null
  return {
    ...option,
    id: `${option.id || option.voice || 'kodik'}-episode-${episode}`,
    episodeNumber: episode,
    title: `Серия ${episode}`,
    embedUrl: addEpisodeParamToUrl(option.embedUrl, episode),
    source: option.source === 'kodik-api-player' ? 'kodik-api-season-episode' : `${option.source || 'kodik'}-episode`,
    syntheticEpisode: true,
  }
}

function expandEpisodeListForVoice(list = [], expectedEpisodes = 0){
  const rows = Array.isArray(list) ? list.filter(usable) : []
  if(rows.length !== 1) return rows
  const base = rows[0]
  const limit = optionEpisodeLimit(base, expectedEpisodes)
  if(limit <= 1) return rows
  return Array.from({ length:limit }, (_, index) => makeSyntheticEpisodeOption(base, index + 1, expectedEpisodes)).filter(Boolean)
}

function collapseToVoiceRepresentatives(rows = []){
  const groups = new Map()
  for(const row of rows){
    const key = `${row.provider || 'kodik'}:${row.voice || 'Kodik'}`
    if(!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }

  return Array.from(groups.values()).map(group => {
    const episodeNumbers = Array.from(new Set(group.map(item => Number(item.episodeNumber || 0)).filter(Boolean))).sort((a,b) => a-b)
    const maxEpisode = episodeNumbers.length ? Math.max(...episodeNumbers) : 0
    const declared = Math.max(...group.map(item => Number(item.episodesCount || item.raw?.episodes_count || item.raw?.last_episode || 0)).filter(Boolean), 0)
    const best = group.reduce((winner, row) => {
      const score = (Number(row.episodesCount || row.raw?.episodes_count || row.raw?.last_episode || 0) * 2)
        + (row.source === 'kodik-api-player' ? 8 : 0)
        + (row.source === 'kodik-api-season-episode' ? 12 : 0)
        + (row.source === 'kodik-api-episode' ? 20 : 0)
        + (row.embedUrl ? 5 : 0)
        + (isSerialLikeOption(row) ? 4 : 0)
      const winnerScore = winner ? (Number(winner.episodesCount || winner.raw?.episodes_count || winner.raw?.last_episode || 0) * 2)
        + (winner.source === 'kodik-api-player' ? 8 : 0)
        + (winner.source === 'kodik-api-season-episode' ? 12 : 0)
        + (winner.source === 'kodik-api-episode' ? 20 : 0)
        + (winner.embedUrl ? 5 : 0)
        + (isSerialLikeOption(winner) ? 4 : 0) : -1
      return !winner || score >= winnerScore ? row : winner
    }, null)
    return {
      ...best,
      episodesCount: Math.max(Number(best?.episodesCount || 0) || 0, declared, maxEpisode, episodeNumbers.length),
      groupedEpisodeCount: Math.max(maxEpisode, episodeNumbers.length),
      episodeNumbers,
      source: best?.source || 'anime_episodes'
    }
  })
}

function normalizeOptions(options = []){
  const map = new Map()
  for(const raw of options || []){
    const option = normalizeOption(raw)
    if(!usable(option)) continue
    const key = `${option.provider}:${option.voice}:${option.episodeNumber}`
    const current = map.get(key)
    const score = (option.source === 'kodik-api-episode' ? 20 : option.source === 'kodik-api-season-episode' ? 12 : 0) + (option.embedUrl ? 5 : 0)
    const currentScore = current ? (current.source === 'kodik-api-episode' ? 20 : current.source === 'kodik-api-season-episode' ? 12 : 0) + (current.embedUrl ? 5 : 0) : -1
    if(!current || score >= currentScore) map.set(key, option)
  }
  const rows = Array.from(map.values())
  const uniqueUrls = new Set(rows.map(item => item.embedUrl))
  const uniqueEpisodes = new Set(rows.map(item => item.episodeNumber))

  // Защита от старой базы: если много серий указывают на один и тот же Kodik serial iframe,
  // это не родной список серий, а старая синтетическая раскладка. Но озвучки терять нельзя:
  // оставляем по одному базовому плееру на каждую озвучку, а серии строим уже на клиенте.
  const safeRows = rows.length > 1 && uniqueUrls.size === 1 && uniqueEpisodes.size > 1
    ? collapseToVoiceRepresentatives(rows)
    : rows

  return safeRows.sort((a,b) => {
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
    declaredCount: Math.max(...episodes.map(item => Number(item.episodesCount || 0)), 0),
    type: episodes.find(item => item.translationType)?.translationType || null,
    quality: episodes.find(item => item.quality)?.quality || null,
  })).sort((a,b) => Math.max(b.count, b.declaredCount || 0) - Math.max(a.count, a.declaredCount || 0) || a.voice.localeCompare(b.voice, 'ru'))
}

function pickInitialOption(options, episode, voice, expectedEpisodes = 0){
  if(!options.length) return null
  const targetEpisode = Math.max(1, Number(episode || 1) || 1)
  const targetVoice = cleanVoice(voice)
  const exact = options.find(item => item.voice === targetVoice && item.episodeNumber === targetEpisode)
    || options.find(item => item.episodeNumber === targetEpisode)
  if(exact) return exact

  const voiceBase = options.find(item => item.voice === targetVoice)
  const syntheticVoice = makeSyntheticEpisodeOption(voiceBase, targetEpisode, expectedEpisodes)
  if(syntheticVoice) return syntheticVoice

  const anySynthetic = makeSyntheticEpisodeOption(options[0], targetEpisode, expectedEpisodes)
  return anySynthetic || voiceBase || options[0]
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
  expectedEpisodes = 0,
  historyItem = null
}){
  const { user } = useAuthState()
  const [options, setOptions] = useState(() => normalizeOptions(playerOptions))
  const [isRefreshingOptions, setIsRefreshingOptions] = useState(false)
  const [optionWarning, setOptionWarning] = useState('')
  const [selected, setSelected] = useState(() => pickInitialOption(normalizeOptions(playerOptions), episode, selectedVoice, expectedEpisodes))
  const [state, setState] = useState(() => normalizePlayerState({ initialEmbedUrl, initialVoice, initialQuality, initialSource, translationTitle, voice, quality }))

  const voices = useMemo(() => groupByVoice(options), [options])
  const activeVoice = selected?.voice || cleanVoice(selectedVoice || state.voice || voice)
  const activeGroup = voices.find(item => item.voice === activeVoice) || null
  const rawActiveEpisodes = activeGroup?.episodes || options.filter(item => item.voice === activeVoice)
  const activeEpisodes = useMemo(() => expandEpisodeListForVoice(rawActiveEpisodes, expectedEpisodes), [rawActiveEpisodes, expectedEpisodes])
  const activeEpisodeNumber = Number(selected?.episodeNumber || episode || 1)
  const currentEmbedUrl = selected?.embedUrl || state.embedUrl || initialEmbedUrl || null
  const currentQuality = selected?.quality || state.quality || quality || null
  const uniqueNativeEpisodes = new Set(activeEpisodes.map(item => Number(item.episodeNumber || 1)))
  const hasRealEpisodeButtons = activeEpisodes.length > 1 && uniqueNativeEpisodes.size > 1
  const canUseVoiceSelector = voices.length > 1

  useEffect(() => {
    const normalized = normalizeOptions(playerOptions)
    setOptions(normalized)
    setSelected(pickInitialOption(normalized, episode, selectedVoice, expectedEpisodes))
  }, [slug, episode, selectedVoice, expectedEpisodes, JSON.stringify(playerOptions)])

  useEffect(() => {
    let cancelled = false
    const current = pickInitialOption(options, episode, selectedVoice, expectedEpisodes)
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
  }, [slug, episode, selectedVoice, options, initialEmbedUrl, initialVoice, initialQuality, initialSource, translationTitle, voice, quality, expectedEpisodes])

  useEffect(() => {
    const uniqueUrls = new Set(options.map(item => item.embedUrl).filter(Boolean))
    const uniqueEpisodes = new Set(options.map(item => item.episodeNumber))
    const hasDeclaredEpisodeCount = options.some(item => Number(item.episodesCount || 0) > 1)
    const hasDetailedEpisodeLinks = uniqueUrls.size > 1 && uniqueEpisodes.size > 1
    const shouldRefresh = !options.length || (!hasDetailedEpisodeLinks && (options.length <= 1 || hasDeclaredEpisodeCount || uniqueEpisodes.size <= 1))
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
          const picked = pickInitialOption(next, activeEpisodeNumber, activeVoice, expectedEpisodes)
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
    const expanded = expandEpisodeListForVoice(list, expectedEpisodes)
    const sameEpisode = expanded.find(item => item.episodeNumber === activeEpisodeNumber)
    chooseOption(sameEpisode || expanded[0] || list[0])
  }

  const nextEpisode = activeEpisodes.find(item => item.episodeNumber > activeEpisodeNumber) || null
  const activeEpisodeTitle = selected?.title || `Серия ${activeEpisodeNumber}`
  const activeVoiceCount = Math.max(activeGroup?.count || 0, activeGroup?.declaredCount || 0, uniqueNativeEpisodes.size || 0, activeEpisodes.length || 0, 1)
  const playerLabel = `Плеер Kodik${activeVoiceCount ? ` (${activeVoiceCount} эп.)` : ''}`

  return <div className="native-kodik-shell native-kodik-v65-light native-kodik-v66-options-fixed" data-aianime-player-ui="v66-options-voices-episodes-fixed">
    <div className="native-kodik-v65-controls" id="episodes">
      <label className="native-kodik-v65-select">
        <span>Озвучка</span>
        <select
          value={activeVoice || ''}
          onChange={(event) => chooseVoice(event.target.value)}
          disabled={voices.length <= 1}
          aria-label="Выбор озвучки"
        >
          {voices.length ? voices.map(item => <option key={item.voice} value={item.voice}>
            {item.voice} ({item.count > 1 ? `${item.count} сер.` : item.declaredCount > 1 ? `${item.declaredCount} сер.` : 'Kodik'})
          </option>) : <option value={activeVoice || 'Kodik'}>{activeVoice || 'Kodik'}</option>}
        </select>
      </label>

      <label className="native-kodik-v65-select">
        <span>Плеер</span>
        <select value="kodik" disabled aria-label="Выбор плеера">
          <option value="kodik">{playerLabel}</option>
        </select>
      </label>
    </div>

    {hasRealEpisodeButtons ? <div className="native-kodik-v65-episodes" aria-label="Выбор серии">
      {activeEpisodes.map(option => <button
        key={`${option.voice}-${option.episodeNumber}`}
        type="button"
        className={option.episodeNumber === activeEpisodeNumber ? 'active' : ''}
        onClick={() => chooseOption(option)}
      >
        {option.episodeNumber}
      </button>)}
    </div> : <div className="native-kodik-v65-note">
      {isRefreshingOptions ? 'Подтягиваем отдельные серии. Плеер уже можно запускать.' : canUseVoiceSelector ? 'Озвучку выбираем сверху, серии переключаются внутри Kodik-плеера.' : 'Серии переключаются внутри Kodik-плеера.'}
    </div>}

    <div className="native-kodik-v65-frame-wrap">
      {state.ok && currentEmbedUrl ? <div className="compact-player compact-player-kodik is-ready is-clean native-kodik-frame native-kodik-v65-frame">
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
      </div> : <div className="compact-player compact-player-kodik is-fallback is-clean native-kodik-frame native-kodik-v65-frame">
        <img src={banner} alt="Аниме"/>
        <div className="compact-player-shade"/>
        <div className="compact-player-center kodik-player-simple-fallback">
          <h3>{title}</h3>
          <p>{state.loading ? 'Загружаем плеер…' : 'Плеер временно недоступен'}</p>
          {!state.loading && state.error ? <small className="kodik-player-error">{state.error}</small> : null}
        </div>
      </div>}
    </div>

    <div className="native-kodik-v65-bottomline">
      <div>
        <span>Серия {activeEpisodeNumber}</span>
        <b>{activeEpisodeTitle}</b>
      </div>
      <div>
        <span>Озвучка</span>
        <b>{activeVoice || 'Kodik'}</b>
      </div>
      {currentQuality ? <em>{currentQuality}</em> : null}
      {nextEpisode ? <button type="button" onClick={() => chooseOption(nextEpisode)}>Следующая →</button> : null}
    </div>

    {optionWarning ? <div className="native-kodik-warning native-kodik-v65-warning">{optionWarning}</div> : null}
  </div>
}
