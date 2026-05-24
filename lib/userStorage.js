import { createBrowserSupabase, hasSupabaseBrowser } from '@/lib/supabaseClient'

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

function isBrowserAuthReady(){
  return typeof window !== 'undefined' && hasSupabaseBrowser()
}

async function getActiveAccount(){
  if(!isBrowserAuthReady()) return null
  const supabase = createBrowserSupabase()
  if(!supabase) return null
  const { data } = await supabase.auth.getSession()
  const user = data?.session?.user || null
  if(!user?.id) return null
  return { supabase, user }
}

function normalizeFavorite(userId, item){
  return {
    user_id: userId,
    anime_slug: item.slug,
    title: item.title || null,
    poster: item.poster || null,
    rating: item.rating || null,
    meta: item.meta || null,
    saved_at: item.savedAt || new Date().toISOString()
  }
}

function normalizeHistory(userId, item){
  return {
    user_id: userId,
    anime_slug: item.slug,
    title: item.title || null,
    poster: item.poster || null,
    banner: item.banner || null,
    episode: Number(item.episode || 1),
    progress: Number(item.progress || 0),
    watched_at: item.watchedAt || new Date().toISOString()
  }
}

function normalizeRating(userId, slug, value){
  return {
    user_id: userId,
    anime_slug: slug,
    rating: Number(value),
    updated_at: new Date().toISOString()
  }
}

function normalizeAiQuery(userId, query){
  return {
    user_id: userId,
    query,
    created_at: new Date().toISOString()
  }
}

function runQuietly(task){
  if(typeof window === 'undefined') return
  task().catch(() => {
    // Автосохранение не должно ломать интерфейс, если Supabase временно недоступен
    // или таблицы профиля ещё не применены в базе.
  })
}

export function syncFavoriteToCloud(item, active){
  if(!item?.slug) return
  runQuietly(async () => {
    const account = await getActiveAccount()
    if(!account) return
    const { supabase, user } = account
    if(active){
      await supabase
        .from('user_favorites')
        .upsert(normalizeFavorite(user.id, item), { onConflict: 'user_id,anime_slug' })
    }else{
      await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('anime_slug', item.slug)
    }
  })
}

export function syncHistoryToCloud(item){
  if(!item?.slug) return
  runQuietly(async () => {
    const account = await getActiveAccount()
    if(!account) return
    const { supabase, user } = account
    await supabase
      .from('user_history')
      .upsert(normalizeHistory(user.id, item), { onConflict: 'user_id,anime_slug' })
  })
}

export function syncRatingToCloud(slug, value){
  if(!slug) return
  runQuietly(async () => {
    const account = await getActiveAccount()
    if(!account) return
    const { supabase, user } = account
    const rating = Number(value)
    if(!rating){
      await supabase
        .from('user_ratings')
        .delete()
        .eq('user_id', user.id)
        .eq('anime_slug', slug)
      return
    }
    await supabase
      .from('user_ratings')
      .upsert(normalizeRating(user.id, slug, rating), { onConflict: 'user_id,anime_slug' })
  })
}

export function syncAiQueryToCloud(query){
  const clean = String(query || '').trim()
  if(!clean) return
  runQuietly(async () => {
    const account = await getActiveAccount()
    if(!account) return
    const { supabase, user } = account
    await supabase.from('user_ai_history').insert(normalizeAiQuery(user.id, clean))
  })
}

export async function syncLocalAnimeDataToCloud(){
  const account = await getActiveAccount()
  if(!account) return { ok:false }
  const { supabase, user } = account

  const favorites = getFavorites().filter(item => item?.slug).map(item => normalizeFavorite(user.id, item))
  const history = getHistory().filter(item => item?.slug).map(item => normalizeHistory(user.id, item))
  const ratings = Object.entries(getRatings()).filter(([,v]) => Number(v)).map(([slug,value]) => normalizeRating(user.id, slug, value))

  if(favorites.length){
    const { error } = await supabase.from('user_favorites').upsert(favorites, { onConflict: 'user_id,anime_slug' })
    if(error) throw error
  }
  if(history.length){
    const { error } = await supabase.from('user_history').upsert(history, { onConflict: 'user_id,anime_slug' })
    if(error) throw error
  }
  if(ratings.length){
    const { error } = await supabase.from('user_ratings').upsert(ratings, { onConflict: 'user_id,anime_slug' })
    if(error) throw error
  }

  return { ok:true, counts:{ favorites:favorites.length, history:history.length, ratings:ratings.length } }
}

export async function restoreCloudAnimeData(){
  const account = await getActiveAccount()
  if(!account) return { ok:false }
  const { supabase, user } = account

  const [favoritesResult, historyResult, ratingsResult] = await Promise.all([
    supabase.from('user_favorites').select('anime_slug,title,poster,rating,meta,saved_at').eq('user_id', user.id).order('saved_at', { ascending:false }).limit(200),
    supabase.from('user_history').select('anime_slug,title,poster,banner,episode,progress,watched_at').eq('user_id', user.id).order('watched_at', { ascending:false }).limit(80),
    supabase.from('user_ratings').select('anime_slug,rating,updated_at').eq('user_id', user.id).order('updated_at', { ascending:false }).limit(500)
  ])

  const localFavorites = getFavorites()
  const localHistory = getHistory()
  const localRatings = getRatings()

  if(!favoritesResult.error && Array.isArray(favoritesResult.data)){
    const merged = new Map()
    localFavorites.forEach(item => item?.slug && merged.set(item.slug, item))
    favoritesResult.data.forEach(item => item?.anime_slug && merged.set(item.anime_slug, {
      slug:item.anime_slug,
      title:item.title,
      poster:item.poster,
      rating:item.rating,
      meta:item.meta,
      savedAt:item.saved_at
    }))
    writeJson('anime:favorites', Array.from(merged.values()).slice(0,200))
  }

  if(!historyResult.error && Array.isArray(historyResult.data)){
    const merged = new Map()
    localHistory.forEach(item => item?.slug && merged.set(item.slug, item))
    historyResult.data.forEach(item => item?.anime_slug && merged.set(item.anime_slug, {
      slug:item.anime_slug,
      title:item.title,
      poster:item.poster,
      banner:item.banner,
      episode:item.episode || 1,
      progress:item.progress || 0,
      watchedAt:item.watched_at
    }))
    writeJson('anime:history', Array.from(merged.values()).slice(0,80))
  }

  if(!ratingsResult.error && Array.isArray(ratingsResult.data)){
    const nextRatings = { ...localRatings }
    ratingsResult.data.forEach(item => {
      if(item?.anime_slug && Number(item.rating)) nextRatings[item.anime_slug] = Number(item.rating)
    })
    writeJson('anime:ratings', nextRatings)
  }

  await syncLocalAnimeDataToCloud()
  return { ok:true }
}

export function saveHistoryItem(item, episode = 1, progress = null){
  const list = getHistory().filter(x => x.slug !== item.slug)
  const safeProgress = progress ?? Math.max(10, Math.min(96, Number(episode || 1) * 8))
  const nextItem = {
    slug:item.slug,
    title:item.title,
    poster:item.poster,
    banner:item.banner,
    rating:item.rating,
    meta:item.meta,
    episode:Number(episode || 1),
    progress:safeProgress,
    watchedAt:new Date().toISOString()
  }
  writeJson('anime:history', [nextItem, ...list].slice(0,80))
  syncHistoryToCloud(nextItem)
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
  syncFavoriteToCloud(item, !exists)
  return !exists
}

export function setUserRating(slug, value){
  const data = getRatings()
  data[slug] = value
  writeJson('anime:ratings', data)
  syncRatingToCloud(slug, value)
}

export function saveAiQuery(query){
  const clean = String(query || '').trim()
  if(!clean) return []
  const list = readJson('ai_query_history', [])
  const next = [clean, ...list.filter(x => x !== clean)].slice(0,12)
  writeJson('ai_query_history', next)
  syncAiQueryToCloud(clean)
  return next
}
