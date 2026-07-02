import { createBrowserSupabase, hasSupabaseBrowser } from '@/lib/supabaseClient'
import { getAccountStorageCapabilities } from '@/lib/accountStorageCapabilities'

const SYNC_STATUS_KEY = 'anime:user-sync-status'
const CLOUD_ANIME_SYNC_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ACCOUNT_ANIME_SYNC === '1'

const ACTIVE_ACCOUNT_KEY = 'anime:active-account-id'
const ACCOUNT_DATA_KEYS = ['anime:favorites', 'anime:history', 'anime:ratings', 'anime:library']

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
    localStorage.setItem('anime:library', JSON.stringify({}))
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

export const LIBRARY_STATUSES = [
  { value:'watching', label:'Смотрю' },
  { value:'planned', label:'Буду смотреть' },
  { value:'completed', label:'Просмотрено' },
  { value:'dropped', label:'Брошено' }
]

export function getLibrary(){
  return readJson('anime:library', {})
}

export function getLibraryStatus(slug){
  if(!slug) return ''
  const row = getLibrary()[slug]
  return row?.status || ''
}

export function libraryStatusLabel(status){
  return LIBRARY_STATUSES.find(item => item.value === status)?.label || ''
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


function missingColumnName(error){
  const text = String(error?.message || error?.details || error || '')
  const quoted = text.match(/['\"]([a-zA-Z0-9_]+)['\"]\s+column/i)
  if(quoted?.[1]) return quoted[1]
  const named = text.match(/column\s+['\"]?([a-zA-Z0-9_]+)['\"]?/i)
  return named?.[1] || ''
}

function isMissingColumn(error, column){
  const text = String(error?.message || error?.details || error || '')
  const name = missingColumnName(error)
  return name === column || (text.includes(column) && /schema cache|column/i.test(text))
}

function isMissingHistoryVoiceColumn(error){
  return isMissingColumn(error, 'voice') || isMissingColumn(error, 'provider')
}

function isMissingHistoryAnimeSlugColumn(error){
  return isMissingColumn(error, 'anime_slug')
}

function friendlyHistorySchemaMessage(){
  return 'Профиль работает. Синхронизация истории проверяется в фоне.'
}

function toHistorySlugFallback(rows){
  const list = Array.isArray(rows) ? rows : [rows]
  return list.map(row => {
    const copy = { ...(row || {}) }
    copy.slug = copy.slug || copy.anime_slug
    delete copy.anime_slug
    delete copy.voice
    delete copy.provider
    return copy
  })
}

async function findExistingRowId(supabase, table, keyValues){
  let query = supabase.from(table).select('id')
  for(const [key, value] of Object.entries(keyValues || {})) query = query.eq(key, value)
  const { data, error } = await query.limit(1)
  if(error) throw error
  return Array.isArray(data) && data[0]?.id ? data[0].id : null
}

async function saveSingleRow(supabase, table, payload, keyValues){
  const existingId = await findExistingRowId(supabase, table, keyValues)
  if(existingId){
    const { error } = await supabase.from(table).update(payload).eq('id', existingId)
    if(error) throw error
    return { ok:true, updated:true }
  }
  const { error } = await supabase.from(table).insert(payload)
  if(error) throw error
  return { ok:true, inserted:true }
}

function historyPayloadForMode(row, mode){
  const copy = { ...(row || {}) }
  if(mode === 'legacy'){
    copy.slug = copy.slug || copy.anime_slug
    delete copy.anime_slug
  }
  if(mode !== 'modern'){
    delete copy.voice
    delete copy.provider
    delete copy.updated_at
  }
  return copy
}

function historyKeyForMode(row, mode){
  return mode === 'legacy'
    ? { user_id:row.user_id, slug:row.slug || row.anime_slug }
    : { user_id:row.user_id, anime_slug:row.anime_slug }
}

async function upsertHistoryRows(supabase, rows, mode){
  if(!mode) return { ok:true, localOnly:true, message:friendlyHistorySchemaMessage() }
  const payload = (Array.isArray(rows) ? rows : [rows]).filter(Boolean)
  if(!payload.length) return { ok:true }

  for(const row of payload){
    const clean = historyPayloadForMode(row, mode)
    await saveSingleRow(supabase, 'user_history', clean, historyKeyForMode(clean, mode))
  }
  return { ok:true, mode }
}

async function loadCloudHistoryRows(supabase, userId, mode){
  if(!mode) return { data:[], error:null, localOnly:true, message:friendlyHistorySchemaMessage(), slugColumn:null }

  const slugColumn = mode === 'legacy' ? 'slug' : 'anime_slug'
  const fields = mode === 'modern'
    ? `${slugColumn},title,poster,banner,episode,progress,voice,provider,watched_at`
    : `${slugColumn},title,poster,banner,episode,progress,watched_at`

  const result = await supabase
    .from('user_history')
    .select(fields)
    .eq('user_id', userId)
    .order('watched_at', { ascending:false })
    .limit(120)

  if(result.error) return result
  return { ...result, localOnly:false, slugColumn }
}

function normalizeRating(userId, slug, value){
  return {
    user_id: userId,
    anime_slug: slug,
    rating: Number(value),
    updated_at: new Date().toISOString()
  }
}

function normalizeLibrary(userId, item, status){
  return {
    user_id: userId,
    anime_slug: item.slug,
    status,
    title: safeItemTitle(item),
    poster: item.poster || item.poster_url || null,
    rating: item.rating || null,
    meta: item.meta || null,
    episode: Number(item.episode || 1),
    voice: item.voice || null,
    updated_at: new Date().toISOString()
  }
}

function isMissingRelation(error, table){
  const text = String(error?.message || error?.details || error || '').toLowerCase()
  return text.includes(table.toLowerCase()) && (/does not exist|schema cache|relation|table/.test(text))
}

function friendlyLibrarySchemaMessage(){
  return 'Библиотека сохранена локально. Для синхронизации выполни SQL-миграцию user_anime_library.'
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
    if(result?.localOnly){
      setUserSyncStatus({ state:'idle', message:result?.message || 'Данные сохранены локально.' })
      return
    }
    setUserSyncStatus({ state:'ok', message:'Данные аккаунта сохранены' })
  }).catch(error => {
    if(isMissingHistoryAnimeSlugColumn(error)){
      setUserSyncStatus({ state:'idle', message:friendlyHistorySchemaMessage() })
      return
    }
    setUserSyncStatus({ state:'error', message:error?.message || 'Supabase временно недоступен' })
  })
}

export function syncFavoriteToCloud(item, active){
  if(!item?.slug || !isAccountStorageAllowed()) return
  runQuietly(async () => {
    const account = await getActiveAccount()
    if(!account) return { skipped:true }
    const capabilities = await getAccountStorageCapabilities()
    if(!capabilities.favorites) return { ok:true, localOnly:true, message:'Избранное сохранено локально. Облачная таблица пока недоступна.' }
    const { supabase, user } = account
    if(active){
      const payload = normalizeFavorite(user.id, item)
      await saveSingleRow(supabase, 'user_favorites', payload, { user_id:user.id, anime_slug:item.slug })
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
  if(!CLOUD_ANIME_SYNC_ENABLED){
    setUserSyncStatus({ state:'idle', message:'История сохранена локально.' })
    return
  }
  runQuietly(async () => {
    const account = await getActiveAccount()
    if(!account) return { skipped:true }
    const capabilities = await getAccountStorageCapabilities()
    if(!capabilities.history) return { ok:true, localOnly:true, message:friendlyHistorySchemaMessage() }
    const { supabase, user } = account
    const payload = normalizeHistory(user.id, item)
    return upsertHistoryRows(supabase, payload, capabilities.history)
  }, 'Сохраняем историю просмотра')
}

export function syncRatingToCloud(slug, value){
  if(!slug || !isAccountStorageAllowed()) return
  runQuietly(async () => {
    const account = await getActiveAccount()
    if(!account) return { skipped:true }
    const capabilities = await getAccountStorageCapabilities()
    if(!capabilities.ratings) return { ok:true, localOnly:true, message:'Оценка сохранена локально. Облачная таблица пока недоступна.' }
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
    const payload = normalizeRating(user.id, slug, rating)
    await saveSingleRow(supabase, 'user_ratings', payload, { user_id:user.id, anime_slug:slug })
    return { ok:true }
  }, 'Сохраняем оценку')
}

export function syncLibraryStatusToCloud(item, status){
  if(!item?.slug || !isAccountStorageAllowed()) return
  if(!CLOUD_ANIME_SYNC_ENABLED){
    setUserSyncStatus({ state:'idle', message:'Библиотека сохранена локально.' })
    return
  }
  runQuietly(async () => {
    const account = await getActiveAccount()
    if(!account) return { skipped:true }
    const capabilities = await getAccountStorageCapabilities()
    if(!capabilities.library) return { ok:true, localOnly:true, message:friendlyLibrarySchemaMessage() }
    const { supabase, user } = account
    const cleanStatus = LIBRARY_STATUSES.some(entry => entry.value === status) ? status : ''
    if(!cleanStatus){
      const { error } = await supabase
        .from('user_anime_library')
        .delete()
        .eq('user_id', user.id)
        .eq('anime_slug', item.slug)
      if(error) throw error
      return { ok:true }
    }

    const payload = normalizeLibrary(user.id, item, cleanStatus)
    await saveSingleRow(supabase, 'user_anime_library', payload, { user_id:user.id, anime_slug:item.slug })
    return { ok:true }
  }, status ? 'Сохраняем статус в библиотеке' : 'Удаляем из библиотеки')
}

export function syncAiQueryToCloud(query){
  const clean = String(query || '').trim()
  if(!clean || !isAccountStorageAllowed()) return
  runQuietly(async () => {
    const account = await getActiveAccount()
    if(!account) return { skipped:true }
    const capabilities = await getAccountStorageCapabilities()
    if(!capabilities.aiHistory) return { ok:true, localOnly:true, message:'AI-запрос сохранён локально.' }
    const { supabase, user } = account
    const { error } = await supabase.from('user_ai_history').insert(normalizeAiQuery(user.id, clean))
    if(error) throw error
    return { ok:true }
  }, 'Сохраняем AI-запрос')
}

export async function syncLocalAnimeDataToCloud(){
  if(!CLOUD_ANIME_SYNC_ENABLED) return { ok:true, localOnly:true, message:'Данные аниме сохранены локально.' }
  const account = await getActiveAccount()
  if(!account) return { ok:false, skipped:true }
  const { supabase, user } = account
  const capabilities = await getAccountStorageCapabilities()
  prepareLocalAccountData(user.id)

  const favorites = getFavorites().filter(item => item?.slug).map(item => normalizeFavorite(user.id, item))
  const history = getHistory().filter(item => item?.slug).map(item => normalizeHistory(user.id, item))
  const ratings = Object.entries(getRatings()).filter(([,v]) => Number(v)).map(([slug,value]) => normalizeRating(user.id, slug, value))
  const library = Object.values(getLibrary()).filter(item => item?.slug && item?.status).map(item => normalizeLibrary(user.id, item, item.status))

  if(capabilities.favorites){
    for(const item of favorites.slice(0, 300)) await saveSingleRow(supabase, 'user_favorites', item, { user_id:user.id, anime_slug:item.anime_slug })
  }
  if(capabilities.history){
    await upsertHistoryRows(supabase, history.slice(0, 120), capabilities.history)
  }
  if(capabilities.ratings){
    for(const item of ratings.slice(0, 800)) await saveSingleRow(supabase, 'user_ratings', item, { user_id:user.id, anime_slug:item.anime_slug })
  }
  if(capabilities.library){
    for(const item of library.slice(0, 600)) await saveSingleRow(supabase, 'user_anime_library', item, { user_id:user.id, anime_slug:item.anime_slug })
  }

  const localOnly = !capabilities.favorites || !capabilities.history || !capabilities.ratings || !capabilities.library
  const message = localOnly ? 'Часть данных сохранена локально: схема аккаунта ещё не полностью применена.' : 'Данные аккаунта синхронизированы'
  setUserSyncStatus({ state:localOnly ? 'idle' : 'ok', message })
  return { ok:true, localOnly, message, counts:{ favorites:favorites.length, history:history.length, ratings:ratings.length, library:library.length } }
}

function newerFirst(a, b, field){
  return new Date(b?.[field] || 0).getTime() - new Date(a?.[field] || 0).getTime()
}

export async function restoreCloudAnimeData(options = {}){
  if(!CLOUD_ANIME_SYNC_ENABLED) return { ok:true, localOnly:true, message:'Облачная синхронизация истории временно отключена.' }
  const account = await getActiveAccount()
  if(!account) return { ok:false, skipped:true }
  const { supabase, user } = account
  const capabilities = await getAccountStorageCapabilities()
  prepareLocalAccountData(user.id)
  const silent = Boolean(options?.silent)

  if(!silent) setUserSyncStatus({ state:'syncing', message:'Загружаем данные аккаунта' })

  const empty = { data:[], error:null, localOnly:true }
  const [favoritesResult, historyResult, ratingsResult, libraryResult] = await Promise.all([
    capabilities.favorites
      ? supabase.from('user_favorites').select('anime_slug,title,poster,rating,meta,saved_at').eq('user_id', user.id).order('saved_at', { ascending:false }).limit(300)
      : Promise.resolve(empty),
    loadCloudHistoryRows(supabase, user.id, capabilities.history),
    capabilities.ratings
      ? supabase.from('user_ratings').select('anime_slug,rating,updated_at').eq('user_id', user.id).order('updated_at', { ascending:false }).limit(800)
      : Promise.resolve(empty),
    capabilities.library
      ? supabase.from('user_anime_library').select('anime_slug,status,title,poster,rating,meta,episode,voice,updated_at').eq('user_id', user.id).order('updated_at', { ascending:false }).limit(600)
      : Promise.resolve({ ...empty, message:friendlyLibrarySchemaMessage() }),
  ])

  const localFavorites = getFavorites()
  const localHistory = getHistory()
  const localRatings = getRatings()

  if(favoritesResult.error) throw favoritesResult.error
  if(historyResult.error) throw historyResult.error
  if(ratingsResult.error) throw ratingsResult.error
  if(libraryResult.error) throw libraryResult.error

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
    writeJson('anime:favorites', Array.from(merged.values()).sort((a,b) => newerFirst(a,b,'savedAt')).slice(0,300))
  }

  if(Array.isArray(historyResult.data)){
    const merged = new Map()
    localHistory.forEach(item => item?.slug && merged.set(item.slug, item))
    historyResult.data.forEach(item => {
      const rowSlug = item?.anime_slug || item?.slug
      if(!rowSlug) return
      merged.set(rowSlug, {
        slug:rowSlug,
        title:item.title,
        poster:item.poster,
        banner:item.banner,
        episode:item.episode || 1,
        progress:item.progress || 0,
        voice:item.voice || null,
        provider:item.provider || null,
        watchedAt:item.watched_at
      })
    })
    writeJson('anime:history', Array.from(merged.values()).sort((a,b) => newerFirst(a,b,'watchedAt')).slice(0,120))
  }

  if(Array.isArray(ratingsResult.data)){
    const nextRatings = { ...localRatings }
    ratingsResult.data.forEach(item => {
      if(item?.anime_slug && Number(item.rating)) nextRatings[item.anime_slug] = Number(item.rating)
    })
    writeJson('anime:ratings', nextRatings)
  }

  if(Array.isArray(libraryResult.data)){
    const nextLibrary = { ...getLibrary() }
    libraryResult.data.forEach(item => {
      if(!item?.anime_slug || !item?.status) return
      nextLibrary[item.anime_slug] = {
        slug:item.anime_slug,
        status:item.status,
        title:item.title,
        poster:item.poster,
        rating:item.rating,
        meta:item.meta,
        episode:item.episode || 1,
        voice:item.voice || null,
        updatedAt:item.updated_at
      }
    })
    writeJson('anime:library', nextLibrary)
  }

  const localOnly = !capabilities.favorites || !capabilities.history || !capabilities.ratings || !capabilities.library
  if(!silent){
    setUserSyncStatus({
      state:localOnly ? 'idle' : 'ok',
      message:localOnly ? 'Профиль работает локально. Для полной облачной синхронизации нужна миграция Supabase.' : 'Данные аккаунта обновлены'
    })
  }
  return { ok:true, localOnly }
}

export async function clearCloudAnimeData(storageKey = 'all'){
  const account = await getActiveAccount()
  if(!account) return { ok:false, skipped:true }
  const { supabase, user } = account
  const capabilities = await getAccountStorageCapabilities()
  const deletions = []

  if(capabilities.favorites && (storageKey === 'all' || storageKey === 'anime:favorites')){
    deletions.push(supabase.from('user_favorites').delete().eq('user_id', user.id))
  }
  if(capabilities.history && (storageKey === 'all' || storageKey === 'anime:history')){
    deletions.push(supabase.from('user_history').delete().eq('user_id', user.id))
  }
  if(capabilities.ratings && (storageKey === 'all' || storageKey === 'anime:ratings')){
    deletions.push(supabase.from('user_ratings').delete().eq('user_id', user.id))
  }
  if(capabilities.library && (storageKey === 'all' || storageKey === 'anime:library')){
    deletions.push(supabase.from('user_anime_library').delete().eq('user_id', user.id))
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
  if(storageKey === 'all' || storageKey === 'anime:library') writeJson('anime:library', {})
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
  const rating = Math.max(0, Math.min(5, Math.round(Number(value) || 0)))
  if(!rating) delete data[slug]
  else data[slug] = rating
  writeJson('anime:ratings', data)
  try{
    window.dispatchEvent(new CustomEvent('anime:rating-updated', { detail:{ slug, value:rating } }))
  }catch{}
  syncRatingToCloud(slug, rating)
  return true
}

export function setLibraryStatus(item, status){
  if(!item?.slug || !isAccountStorageAllowed()) return false
  const cleanStatus = LIBRARY_STATUSES.some(entry => entry.value === status) ? status : ''
  const data = getLibrary()
  if(!cleanStatus){
    delete data[item.slug]
  }else{
    data[item.slug] = {
      slug:item.slug,
      status:cleanStatus,
      title:safeItemTitle(item),
      poster:item.poster || item.poster_url || null,
      banner:item.banner || null,
      rating:item.rating || null,
      meta:item.meta || null,
      episode:Number(item.episode || 1),
      voice:item.voice || null,
      updatedAt:new Date().toISOString()
    }
  }
  writeJson('anime:library', data)
  try{ window.dispatchEvent(new CustomEvent('anime:library-updated', { detail:{ slug:item.slug, status:cleanStatus } })) }catch{}
  syncLibraryStatusToCloud(item, cleanStatus)
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
