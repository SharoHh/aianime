import 'server-only'
import '@/lib/runtimeEnv'
import { createClient } from '@supabase/supabase-js'
import { hasSupabase } from '@/lib/supabaseServer'

const CACHE_TTL_MS = Math.max(15000, Number(process.env.AIANIME_SITE_STATS_CACHE_TTL_MS || 60000))
const STALE_TTL_MS = Math.max(CACHE_TTL_MS, Number(process.env.AIANIME_SITE_STATS_STALE_TTL_MS || 86400000))
const REQUEST_TIMEOUT_MS = Math.max(2500, Number(process.env.AIANIME_SITE_STATS_TIMEOUT_MS || 7000))
const PRESENCE_WINDOW_MINUTES = 5

const state = globalThis.__AIANIME_SITE_STATS_CACHE__ || {
  snapshot:null,
  updatedAt:0,
  pending:null,
}
globalThis.__AIANIME_SITE_STATS_CACHE__ = state

function supabaseUrl(){
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || ''
}

function serviceRoleKey(){
  return process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function timeoutFetch(input, init = {}){
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const externalSignal = init.signal

  if(externalSignal){
    if(externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener('abort', () => controller.abort(), { once:true })
  }

  return fetch(input, {
    ...init,
    signal:controller.signal,
    cache:'no-store',
  }).finally(() => clearTimeout(timer))
}

function getAdminClient(){
  if(!hasSupabase()) return null
  const url = supabaseUrl()
  const key = serviceRoleKey()
  if(!url || !key) return null

  const cacheKey = `${url}:${key.slice(-8)}`
  const cached = globalThis.__AIANIME_SITE_STATS_ADMIN_CLIENT__
  if(cached?.key === cacheKey && cached?.client) return cached.client

  const client = createClient(url, key, {
    auth:{
      autoRefreshToken:false,
      persistSession:false,
      detectSessionInUrl:false,
    },
    global:{ fetch:timeoutFetch },
  })

  globalThis.__AIANIME_SITE_STATS_ADMIN_CLIENT__ = { key:cacheKey, client }
  return client
}

function finiteCount(value){
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

async function countTable(client, table){
  const { count, error } = await client
    .from(table)
    .select('id', { count:'exact', head:true })

  if(error) throw new Error(`${table}: ${error.message || 'count failed'}`)
  const safe = finiteCount(count)
  if(safe === null) throw new Error(`${table}: count missing`)
  return safe
}

async function countFirstAvailableTable(client, tables){
  let lastError = null
  for(const table of tables){
    try{
      return await countTable(client, table)
    }catch(error){
      lastError = error
    }
  }
  throw lastError || new Error('table count failed')
}

async function countAuthUsers(client){
  const perPage = 1000
  let total = 0

  for(let page = 1; page <= 100; page += 1){
    const { data, error } = await client.auth.admin.listUsers({ page, perPage })
    if(error) throw new Error(`auth users: ${error.message || 'list failed'}`)

    const users = Array.isArray(data?.users) ? data.users : []
    const explicitTotal = finiteCount(data?.total)
    if(explicitTotal !== null && explicitTotal > 0 && explicitTotal >= users.length) return explicitTotal

    total += users.length
    if(users.length < perPage) return total
  }

  return total
}

async function countAccounts(client){
  return countAuthUsers(client)
}

function activeSince(){
  return new Date(Date.now() - PRESENCE_WINDOW_MINUTES * 60 * 1000).toISOString()
}

function visitorFromPresence(row){
  const raw = String(row?.visitor_id || '')
  return raw.includes(':') ? raw.split(':')[0] : raw
}

async function countPresence(client){
  const { data, error } = await client
    .from('site_presence')
    .select('visitor_id')
    .gte('last_seen', activeSince())
    .limit(5000)

  if(error) throw new Error(`site_presence: ${error.message || 'read failed'}`)
  const rows = Array.isArray(data) ? data : []
  const users = new Set(rows.map(visitorFromPresence).filter(Boolean))
  return {
    online:Math.max(1, users.size),
    openTabs:Math.max(1, rows.length),
  }
}

function cachedSnapshot(maxAge = CACHE_TTL_MS){
  if(!state.snapshot || !state.updatedAt) return null
  if(Date.now() - state.updatedAt > maxAge) return null
  return state.snapshot
}

function metricFromResult(result, key, previous){
  if(result.status === 'fulfilled'){
    const raw = key ? result.value?.[key] : result.value
    const value = finiteCount(raw)
    if(value !== null) return { value, stale:false }
  }

  const fallback = finiteCount(previous)
  return { value:fallback, stale:fallback !== null }
}

async function collectFreshStats(){
  const client = getAdminClient()
  if(!client) throw new Error('Supabase runtime is disabled or not configured')

  const previous = state.snapshot || {}
  const [accountsResult, animeResult, commentsResult, presenceResult] = await Promise.allSettled([
    countAccounts(client),
    countFirstAvailableTable(client, ['anime','anime_titles']),
    countFirstAvailableTable(client, ['anime_comments','comments']),
    countPresence(client),
  ])

  const accounts = metricFromResult(accountsResult, null, previous.accounts)
  const anime = metricFromResult(animeResult, null, previous.anime)
  const comments = metricFromResult(commentsResult, null, previous.comments)
  const online = metricFromResult(presenceResult, 'online', previous.online ?? 1)
  const openTabs = metricFromResult(presenceResult, 'openTabs', previous.openTabs ?? 1)
  const staleKeys = []

  if(accounts.stale) staleKeys.push('accounts')
  if(anime.stale) staleKeys.push('anime')
  if(comments.stale) staleKeys.push('comments')
  if(online.stale) staleKeys.push('online')
  if(openTabs.stale) staleKeys.push('openTabs')

  const snapshot = {
    accounts:accounts.value,
    anime:anime.value,
    comments:comments.value,
    online:online.value ?? 1,
    openTabs:openTabs.value ?? 1,
    source:'supabase',
    degraded:staleKeys.length > 0,
    staleKeys,
    updatedAt:new Date().toISOString(),
  }

  const hasUsefulValue = [snapshot.accounts, snapshot.anime, snapshot.comments].some(value => finiteCount(value) !== null)
  if(hasUsefulValue){
    state.snapshot = snapshot
    state.updatedAt = Date.now()
  }

  return snapshot
}

export async function getSiteStatsSnapshot({ force = false } = {}){
  if(!force){
    const fresh = cachedSnapshot(CACHE_TTL_MS)
    if(fresh) return fresh
  }

  if(state.pending) return state.pending

  state.pending = collectFreshStats()
    .catch(error => {
      const stale = cachedSnapshot(STALE_TTL_MS)
      if(stale){
        return {
          ...stale,
          degraded:true,
          staleKeys:['accounts','anime','comments','online','openTabs'],
          error:error?.message || 'site stats refresh failed',
        }
      }
      return {
        accounts:null,
        anime:null,
        comments:null,
        online:1,
        openTabs:1,
        source:hasSupabase() ? 'supabase' : 'local',
        degraded:true,
        staleKeys:['accounts','anime','comments'],
        error:error?.message || 'site stats unavailable',
        updatedAt:new Date().toISOString(),
      }
    })
    .finally(() => {
      state.pending = null
    })

  return state.pending
}
