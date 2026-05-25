import { createBrowserSupabase, hasSupabaseBrowser } from '@/lib/supabaseClient'

const SYNC_STATUS_KEY = 'anime:user-sync-status'

const ACTIVE_ACCOUNT_KEY = 'anime:active-account-id'
const ACCOUNT_DATA_KEYS = ['anime:favorites', 'anime:history', 'anime:ratings']

export function getActiveAccountId(){
  if(typeof window === 'undefined') return null
  try{ return localStorage.getItem(ACTIVE_ACCOUNT_KEY) || null }catch{ return null }
}

export function setActiveAccountId(userId){
  if(typeof window === 'undefined') return
  try{
    if(userId) localStorage.setItem(ACTIVE_ACCOUNT_KEY, String(userId))
    else localStorage.removeItem(ACTIVE_ACCOUNT_KEY)
  }catch{}
}

export function clearLocalAccountData(){
  if(typeof window === 'undefined') return
  try{
    localStorage.setItem('anime:favorites', JSON.stringify([]))
    localStorage.setItem('anime:history', JSON.stringify([]))
    localStorage.setItem('anime:ratings', JSON.stringify({}))
  }catch{}
  window.dispatchEvent(new Event('anime:user-updated'))
}

export function prepareLocalAccountData(userId){
  if(typeof window === 'undefined' || !userId) return
  const previousUserId = getActiveAccountId()
  if(previousUserId && previousUserId !== String(userId)){
    clearLocalAccountData()
  }
  setActiveAccountId(userId)
}

export function resetLocalAccountState(){
  clearLocalAccountData()
  setActiveAccountId(null)
  setUserSyncStatus({ state:'idle', message:'Войди в аккаунт, чтобы сохранять избранное, историю и оценки.' })
}

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

export function getUserSyncStatus(){
  return readJson(SYNC_STATUS_KEY, { state:'idle', message:'', updatedAt:null })
}

export function setUserSyncStatus(next){
  if(typeof window === 'undefined') return
  const payload = {
    state: next?.state || 'idle',
    message: next?.message || '',
    updatedAt: new Date().toISOString(),
    ...(next || {})
  }
  try{ localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(payload)) }catch{}
  window.dispatchEvent(new CustomEvent('anime:user-sync-status', { detail:payload }))
}

function isBrowserAuthReady(){
  return typeof window !== 'undefined' && hasSupabaseBrowser()
}

export function getCachedAccountUser(){
  if(typeof window === 'undefined') return null
  try{
    const raw = localStorage.getItem('anime:auth-user-cache')
    if(!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.id ? parsed : null
  }catch{
    return null
  }
}

export function isAccountStorageAllowed(){
  return Boolean(getCachedAccountUser())
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

function safeItemTitle(item){
  return item?.title || item?.title_ru || item?.name || null
}

function normalizeFavorite(userId, item){
  return {
    user_id: userId,
    anime_slug: item.slug,
    title: safeItemTitle(item),
    poster: item.poster || item.poster_url || null,
    rating: item.rating || null,
    meta: item.meta || null,
    saved_at: item.savedAt || new Date().toISOString()
  }
}

function normalizeHistory(userId, item){
  return {
    user_id: userId,
    anime_slug: item.slug,
    title: safeItemTitle(item),
    poster: item.poster || item.poster_url || null,
    banner: item.banner || null,
    episode: Number(item.episode || 1),
    progress: Number(item.progress || 0),
    voice: item.voice || null,
    provider: item.provider || null,
    watched_at: item.watchedAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}


function stripHistoryVoiceFields(rows){
  const list = Array.isArray(rows) ? rows : [rows]
  return list.map(row => {
    const copy = { ...(row || {}) }
    delete copy.voice
    delete copy.provider
    return copy
  })
}

function isMissingHistoryVoiceColumn(error){
  const text = String(error?.message || error?.details || error || '')
  return /voice|provider|schema cache|column/i.test(text)
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

function runQuietly(task, message = 'Синхронизация аккаунта'){
  if(typeof window === 'undefined') return
  setUserSyncStatus({ state:'syncing', message })
  task().then(result => {
    if(result?.skipped){
      setUserSyncStatus({ state:'idle', message:'Войди в аккаунт, чтобы сохранять данные.' })
      return
    }
    setUserSyncStatus({ state:'ok', message:'Данные аккаунта сохранены' })
  }).catch(error => {
    setUserSyncStatus({ state:'error', message:error?.message || 'Supabase временно недоступен' })
  })
}

export function syncFavoriteToCloud(item, active){
  if(!item?.slug || !isAccountStorageAllowed()) return
  runQuietly(async () => {
    const account = await getActiveAccount()
    if(!account) return { skipped:true }
    const { supabase, user } = account
    if(active){
      const { error } = await supabase
        .from('user_favorites')
        .upsert(normalizeFavorite(user.id, item), { onConflict: 'user_id,anime_slug' })
      if(error) throw error
    }else{
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('anime_slug', item.slug)
      if(error) throw error
    }
    return { ok:true }
  }, active ? 'Добавляем в избранное аккаунта' : 'Удаляем из избранного аккаунта')
}

export function syncHistoryToCloud(item){
  if(!item?.slug || !isAccountStorageAllowed()) return
  runQuietly(async () => {
    const account = await getActiveAccount()
    if(!account) return { skipped:true }
    const { supabase, user } = account
    const payload = normalizeHistory(user.id, item)
    const { error } = await supabase
      .from('user_history')
      .upsert(payload, { onConflict: 'user_id,anime_slug' })
    if(error){
      if(isMissingHistoryVoiceColumn(error)){
        const retry = await supabase
          .from('user_history')
          .upsert(stripHistoryVoiceFields(payload)[0], { onConflict: 'user_id,anime_slug' })
        if(retry.error) throw retry.error
      }else{
        throw error
      }
    }
    return { ok:true }
  }, 'Сохраняем историю просмотра')
}

export function syncRatingToCloud(slug, value){
  if(!slug || !isAccountStorageAllowed()) return
  runQuietly(async () => {
    const account = await getActiveAccount()
    if(!account) return { skipped:true }
    const { supabase, user } = account
    const rating = Number(value)
    if(!rating){
      const { error } = await supabase
        .from('user_ratings')
        .delete()
        .eq('user_id', user.id)
        .eq('anime_slug', slug)
      if(error) throw error
      return { ok:true }
    }
    const { error } = await supabase
      .from('user_ratings')
      .upsert(normalizeRating(user.id, slug, rating), { onConflict: 'user_id,anime_slug' })
    if(error) throw error
    return { ok:true }
  }, 'Сохраняем оценку')
}

export function syncAiQueryToCloud(query){
  const clean = String(query || '').trim()
  if(!clean || !isAccountStorageAllowed()) return
  runQuietly(async () => {
    const account = await getActiveAccount()
    if(!account) return { skipped:true }
    const { supabase, user } = account
    const { error } = await supabase.from('user_ai_history').insert(normalizeAiQuery(user.id, clean))
    if(error) throw error
    return { ok:true }
  }, 'Сохраняем AI-запрос')
}

export async function syncLocalAnimeDataToCloud(){
  const account = await getActiveAccount()
  if(!account) return { ok:false, skipped:true }
  const { supabase, user } = account
  prepareLocalAccountData(user.id)

  const favorites = getFavorites().filter(item => item?.slug).map(item => normalizeFavorite(user.id, item))
  const history = getHistory().filter(item => item?.slug).map(item => normalizeHistory(user.id, item))
  const ratings = Object.entries(getRatings()).filter(([,v]) => Number(v)).map(([slug,value]) => normalizeRating(user.id, slug, value))

  if(favorites.length){
    const { error } = await supabase.from('user_favorites').upsert(favorites, { onConflict: 'user_id,anime_slug' })
    if(error) throw error
  }
  if(history.length){
    const { error } = await supabase.from('user_history').upsert(history, { onConflict: 'user_id,anime_slug' })
    if(error){
      if(isMissingHistoryVoiceColumn(error)){
        const retry = await supabase.from('user_history').upsert(stripHistoryVoiceFields(history), { onConflict: 'user_id,anime_slug' })
        if(retry.error) throw retry.error
      }else{
        throw error
      }
    }
  }
  if(ratings.length){
    const { error } = await supabase.from('user_ratings').upsert(ratings, { onConflict: 'user_id,anime_slug' })
    if(error) throw error
  }

  setUserSyncStatus({ state:'ok', message:'Данные аккаунта синхронизированы' })
  return { ok:true, counts:{ favorites:favorites.length, history:history.length, ratings:ratings.length } }
}

function newerFirst(a, b, field){
  return new Date(b?.[field] || 0).getTime() - new Date(a?.[field] || 0).getTime()
}

export async function restoreCloudAnimeData(options = {}){
  const account = await getActiveAccount()
  if(!account) return { ok:false, skipped:true }
  const { supabase, user } = account
  prepareLocalAccountData(user.id)
  const silent = Boolean(options?.silent)

  if(!silent) setUserSyncStatus({ state:'syncing', message:'Загружаем данные аккаунта' })

  const [favoritesResult, historyResult, ratingsResult] = await Promise.all([
    supabase.from('user_favorites').select('anime_slug,title,poster,rating,meta,saved_at').eq('user_id', user.id).order('saved_at', { ascending:false }).limit(300),
    supabase.from('user_history').select('anime_slug,title,poster,banner,episode,progress,watched_at').eq('user_id', user.id).order('watched_at', { ascending:false }).limit(120),
    supabase.from('user_ratings').select('anime_slug,rating,updated_at').eq('user_id', user.id).order('updated_at', { ascending:false }).limit(800)
  ])

  const localFavorites = getFavorites()
  const localHistory = getHistory()
  const localRatings = getRatings()

  if(favoritesResult.error) throw favoritesResult.error
  if(historyResult.error) throw historyResult.error
  if(ratingsResult.error) throw ratingsResult.error

  if(Array.isArray(favoritesResult.data)){
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
    const next = Array.from(merged.values()).sort((a,b) => newerFirst(a,b,'savedAt')).slice(0,300)
    writeJson('anime:favorites', next)
  }

  if(Array.isArray(historyResult.data)){
    const merged = new Map()
    localHistory.forEach(item => item?.slug && merged.set(item.slug, item))
    historyResult.data.forEach(item => item?.anime_slug && merged.set(item.anime_slug, {
      slug:item.anime_slug,
      title:item.title,
      poster:item.poster,
      banner:item.banner,
      episode:item.episode || 1,
      progress:item.progress || 0,
      voice:item.voice || null,
      provider:item.provider || null,
      watchedAt:item.watched_at
    }))
    const next = Array.from(merged.values()).sort((a,b) => newerFirst(a,b,'watchedAt')).slice(0,120)
    writeJson('anime:history', next)
  }

  if(Array.isArray(ratingsResult.data)){
    const nextRatings = { ...localRatings }
    ratingsResult.data.forEach(item => {
      if(item?.anime_slug && Number(item.rating)) nextRatings[item.anime_slug] = Number(item.rating)
    })
    writeJson('anime:ratings', nextRatings)
  }

  const syncResult = await syncLocalAnimeDataToCloud()
  if(!silent) setUserSyncStatus({ state:'ok', message:'Данные аккаунта обновлены' })
  return { ok:true, sync:syncResult }
}

export async function clearCloudAnimeData(storageKey = 'all'){
  const account = await getActiveAccount()
  if(!account) return { ok:false, skipped:true }
  const { supabase, user } = account
  const deletions = []

  if(storageKey === 'all' || storageKey === 'anime:favorites'){
    deletions.push(supabase.from('user_favorites').delete().eq('user_id', user.id))
  }
  if(storageKey === 'all' || storageKey === 'anime:history'){
    deletions.push(supabase.from('user_history').delete().eq('user_id', user.id))
  }
  if(storageKey === 'all' || storageKey === 'anime:ratings'){
    deletions.push(supabase.from('user_ratings').delete().eq('user_id', user.id))
  }

  const results = await Promise.all(deletions)
  const failed = results.find(result => result?.error)
  if(failed?.error) throw failed.error
  setUserSyncStatus({ state:'ok', message:'Данные аккаунта очищены' })
  return { ok:true }
}

export function clearLocalAnimeData(storageKey = 'all'){
  if(storageKey === 'all' || storageKey === 'anime:favorites') writeJson('anime:favorites', [])
  if(storageKey === 'all' || storageKey === 'anime:history') writeJson('anime:history', [])
  if(storageKey === 'all' || storageKey === 'anime:ratings') writeJson('anime:ratings', {})
}

export function clearAnimeData(storageKey = 'all'){
  clearLocalAnimeData(storageKey)
  runQuietly(async () => clearCloudAnimeData(storageKey), 'Очищаем данные аккаунта')
}

export function saveHistoryItem(item, episode = 1, progress = null, options = {}){
  if(!item?.slug || !isAccountStorageAllowed()) return false
  const list = getHistory().filter(x => x.slug !== item.slug)
  const safeProgress = progress ?? 0
  const nextItem = {
    slug:item.slug,
    title:safeItemTitle(item),
    poster:item.poster || item.poster_url,
    banner:item.banner,
    rating:item.rating,
    meta:item.meta,
    episode:Number(episode || 1),
    progress:safeProgress,
    voice:options?.voice || item.voice || null,
    provider:options?.provider || item.provider || null,
    watchedAt:new Date().toISOString()
  }
  writeJson('anime:history', [nextItem, ...list].slice(0,120))
  if(options?.cloud !== false) syncHistoryToCloud(nextItem)
  return true
}

export function toggleFavoriteItem(item){
  if(!item?.slug || !isAccountStorageAllowed()) return false
  const list = getFavorites()
  const exists = list.some(x => x.slug === item.slug)
  const next = exists
    ? list.filter(x => x.slug !== item.slug)
    : [{
        slug:item.slug,
        title:safeItemTitle(item),
        poster:item.poster || item.poster_url,
        banner:item.banner,
        rating:item.rating,
        meta:item.meta,
        savedAt:new Date().toISOString()
      }, ...list].slice(0,300)
  writeJson('anime:favorites', next)
  syncFavoriteToCloud(item, !exists)
  return !exists
}

export function setUserRating(slug, value){
  if(!slug || !isAccountStorageAllowed()) return false
  const data = getRatings()
  const rating = Number(value)
  if(!rating) delete data[slug]
  else data[slug] = rating
  writeJson('anime:ratings', data)
  syncRatingToCloud(slug, rating)
  return true
}

export function saveAiQuery(query){
  const clean = String(query || '').trim()
  if(!clean || !isAccountStorageAllowed()) return []
  const list = readJson('ai_query_history', [])
  const next = [clean, ...list.filter(x => x !== clean)].slice(0,12)
  writeJson('ai_query_history', next)
  syncAiQueryToCloud(clean)
  return next
}
