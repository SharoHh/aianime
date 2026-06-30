import { NextResponse } from 'next/server'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CACHE_MS = 5 * 60 * 1000
const STALE_MS = 24 * 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 3000
const PRESENCE_WINDOW_MINUTES = 5

const cache = globalThis.__AIANIME_SAFE_SITE_STATS__ || {
  value:null,
  updatedAt:0,
  pending:null,
}
globalThis.__AIANIME_SAFE_SITE_STATS__ = cache

function finiteCount(value){
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function parseCountHeader(header){
  const total = String(header || '').split('/').pop()
  return finiteCount(total)
}

async function countTable(table){
  try{
    const response = await supabaseRequest(`${table}?select=*&limit=0`, {
      method:'GET',
      timeout:REQUEST_TIMEOUT_MS,
      headers:{ Prefer:'count=exact' },
    })
    if(!response.ok) return null
    return parseCountHeader(response.headers.get('content-range'))
  }catch{
    return null
  }
}

async function countFirstTable(tables){
  for(const table of tables){
    const count = await countTable(table)
    if(count !== null) return count
  }
  return null
}

function supabaseUrl(){
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || ''
}

async function countAuthUsers(){
  const url = supabaseUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if(!url || !key) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try{
    const response = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1`, {
      method:'GET',
      cache:'no-store',
      signal:controller.signal,
      headers:{
        apikey:key,
        Authorization:`Bearer ${key}`,
      },
    })
    if(!response.ok) return null
    const body = await response.json().catch(() => null)
    return finiteCount(body?.total ?? body?.total_count ?? body?.count)
  }catch{
    return null
  }finally{
    clearTimeout(timer)
  }
}

function activeSince(){
  return new Date(Date.now() - PRESENCE_WINDOW_MINUTES * 60 * 1000).toISOString()
}

function visitorFromPresence(row){
  const raw = String(row?.visitor_id || '')
  return raw.includes(':') ? raw.split(':')[0] : raw
}

async function countPresence(){
  try{
    const since = encodeURIComponent(activeSince())
    const response = await supabaseRequest(`site_presence?select=visitor_id&last_seen=gte.${since}&limit=5000`, {
      method:'GET',
      timeout:REQUEST_TIMEOUT_MS,
    })
    if(!response.ok) return { online:null, openTabs:null }
    const rows = await response.json().catch(() => [])
    if(!Array.isArray(rows)) return { online:null, openTabs:null }
    const visitors = new Set(rows.map(visitorFromPresence).filter(Boolean))
    return {
      online:visitors.size || null,
      openTabs:rows.length || null,
    }
  }catch{
    return { online:null, openTabs:null }
  }
}

function cached(maxAge){
  if(!cache.value || !cache.updatedAt) return null
  return Date.now() - cache.updatedAt <= maxAge ? cache.value : null
}

async function collectStats(){
  if(!hasSupabase()){
    return {
      accounts:null,
      anime:null,
      comments:null,
      online:1,
      openTabs:1,
      source:'local',
      degraded:true,
      updatedAt:new Date().toISOString(),
    }
  }

  const previous = cache.value || {}
  const [authUsers, profiles, anime, comments, presence] = await Promise.all([
    countAuthUsers(),
    countTable('profiles'),
    countFirstTable(['anime','anime_titles']),
    countFirstTable(['anime_comments','comments']),
    countPresence(),
  ])

  const value = {
    accounts:authUsers ?? profiles ?? previous.accounts ?? null,
    anime:anime ?? previous.anime ?? null,
    comments:comments ?? previous.comments ?? null,
    online:presence.online ?? previous.online ?? 1,
    openTabs:presence.openTabs ?? previous.openTabs ?? 1,
    source:'supabase',
    degraded:[authUsers ?? profiles, anime, comments].some(item => item === null),
    updatedAt:new Date().toISOString(),
  }

  if([value.accounts, value.anime, value.comments].some(item => finiteCount(item) !== null)){
    cache.value = value
    cache.updatedAt = Date.now()
  }

  return value
}

async function getStats(){
  const fresh = cached(CACHE_MS)
  if(fresh) return fresh
  if(cache.pending) return cache.pending

  cache.pending = collectStats()
    .catch(() => cached(STALE_MS) || {
      accounts:null,
      anime:null,
      comments:null,
      online:1,
      openTabs:1,
      source:'supabase',
      degraded:true,
      updatedAt:new Date().toISOString(),
    })
    .finally(() => { cache.pending = null })

  return cache.pending
}

export async function GET(){
  const stats = await getStats()
  return NextResponse.json(stats, {
    status:200,
    headers:{
      'Cache-Control':'public, max-age=30, s-maxage=300, stale-while-revalidate=600',
      'X-Robots-Tag':'noindex, nofollow',
    },
  })
}
