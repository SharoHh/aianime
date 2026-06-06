import { NextResponse } from 'next/server'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'

const WINDOW_MINUTES = 5

function activeSince(){
  return new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()
}

function parseCountHeader(header){
  const value = String(header || '')
  const total = value.split('/').pop()
  const number = Number(total)
  return Number.isFinite(number) ? number : null
}

async function countTable(table){
  if(!hasSupabase()) return null
  try{
    const res = await supabaseRequest(`${table}?select=*&limit=0`, {
      method:'GET',
      timeout:6000,
      headers:{ Prefer:'count=exact' },
    })
    if(!res.ok) return null
    return parseCountHeader(res.headers.get('content-range'))
  }catch{
    return null
  }
}

async function countDistinctUsersFromActivity(){
  if(!hasSupabase()) return null
  const tables = ['user_history','user_favorites','user_ratings','user_ai_history']
  const users = new Set()

  for(const table of tables){
    try{
      const res = await supabaseRequest(`${table}?select=user_id`, { method:'GET', timeout:6000 })
      if(!res.ok) continue
      const rows = await res.json().catch(() => [])
      if(Array.isArray(rows)) rows.forEach(row => row?.user_id && users.add(String(row.user_id)))
    }catch{}
  }

  return users.size ? users.size : null
}

function splitVisitor(row){
  const raw = String(row?.visitor_id || '')
  return raw.includes(':') ? raw.split(':')[0] : raw
}

async function countPresence(){
  if(!hasSupabase()) return { online:null, openTabs:null }
  try{
    const since = encodeURIComponent(activeSince())
    const res = await supabaseRequest(`site_presence?select=visitor_id&last_seen=gte.${since}`, { method:'GET', timeout:6000 })
    if(!res.ok) return { online:null, openTabs:null }
    const rows = await res.json().catch(() => [])
    if(!Array.isArray(rows)) return { online:null, openTabs:null }
    const users = new Set(rows.map(splitVisitor).filter(Boolean))
    return { online:users.size || null, openTabs:rows.length || null }
  }catch{
    return { online:null, openTabs:null }
  }
}

export async function GET(){
  if(!hasSupabase()){
    return NextResponse.json({ accounts:null, comments:null, online:null, openTabs:null, source:'local' })
  }

  const presence = await countPresence()
  const accounts = await countTable('profiles') ?? await countDistinctUsersFromActivity()
  const comments = await countTable('anime_comments') ?? await countTable('comments')

  return NextResponse.json({
    accounts,
    comments,
    online:presence.online,
    openTabs:presence.openTabs,
    source:'supabase',
  })
}
