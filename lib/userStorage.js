export function readJson(key, fallback){
  if(typeof window === 'undefined') return fallback
  try{
    const raw = localStorage.getItem(key)
    if(!raw) return fallback
    return JSON.parse(raw)
  }catch{
    return fallback
  }
}

export function writeJson(key, value){
  if(typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new Event('anime:user-updated'))
}

export function getFavorites(){
  return readJson('anime:favorites', [])
}

export function getHistory(){
  return readJson('anime:history', [])
}

export function getRatings(){
  return readJson('anime:ratings', {})
}

export function saveHistoryItem(item, episode = 1, progress = null){
  const list = getHistory().filter(x => x.slug !== item.slug)
  const safeProgress = progress ?? Math.max(10, Math.min(96, Number(episode || 1) * 8))
  writeJson('anime:history', [{
    slug:item.slug,
    title:item.title,
    poster:item.poster,
    banner:item.banner,
    rating:item.rating,
    meta:item.meta,
    episode:Number(episode || 1),
    progress:safeProgress,
    watchedAt:new Date().toISOString()
  }, ...list].slice(0,80))
}

export function toggleFavoriteItem(item){
  const list = getFavorites()
  const exists = list.some(x => x.slug === item.slug)
  const next = exists
    ? list.filter(x => x.slug !== item.slug)
    : [{
        slug:item.slug,
        title:item.title,
        poster:item.poster,
        banner:item.banner,
        rating:item.rating,
        meta:item.meta,
        savedAt:new Date().toISOString()
      }, ...list].slice(0,200)
  writeJson('anime:favorites', next)
  return !exists
}

export function setUserRating(slug, value){
  const data = getRatings()
  data[slug] = value
  writeJson('anime:ratings', data)
}

export function saveAiQuery(query){
  const clean = String(query || '').trim()
  if(!clean) return []
  const list = readJson('ai_query_history', [])
  const next = [clean, ...list.filter(x => x !== clean)].slice(0,12)
  writeJson('ai_query_history', next)
  return next
}
