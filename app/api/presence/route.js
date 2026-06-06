import { NextResponse } from 'next/server'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'

const WINDOW_MINUTES = 5

function activeSince(){
  return new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()
}

function cleanId(value, fallback){
  return String(value || fallback)
    .replace(/[^a-zA-Z0-9._:-]/g, '')
    .slice(0, 96) || fallback
}

function splitVisitor(row){
  const raw = String(row?.visitor_id || '')
  return raw.includes(':') ? raw.split(':')[0] : raw
}

async function readActivePresence(){
  if(!hasSupabase()) return { online:1, openTabs:1 }

  const since = encodeURIComponent(activeSince())
  const res = await supabaseRequest(`site_presence?select=visitor_id&last_seen=gte.${since}`, {
    method:'GET',
    timeout:6000,
  })
  if(!res.ok) return { online:1, openTabs:1 }

  const rows = await res.json().catch(() => [])
  if(!Array.isArray(rows) || rows.length === 0) return { online:1, openTabs:1 }

  const users = new Set(rows.map(splitVisitor).filter(Boolean))
  return {
    online: Math.max(1, users.size),
    openTabs: Math.max(1, rows.length),
  }
}

export async function GET(){
  try{
    return NextResponse.json(await readActivePresence())
  }catch{
    return NextResponse.json({ online:1, openTabs:1 })
  }
}

export async function POST(request){
  try{
    const body = await request.json().catch(() => ({}))
    const visitorId = cleanId(body.visitorId, 'anonymous')
    const tabId = cleanId(body.tabId, 'tab')
    const presenceKey = `${visitorId}:${tabId}`.slice(0, 128)
    const page = String(body.page || '/').slice(0, 180)

    if(hasSupabase()){
      await supabaseRequest('site_presence?on_conflict=visitor_id', {
        method:'POST',
        timeout:6000,
        body:JSON.stringify([{ visitor_id:presenceKey, page, last_seen:new Date().toISOString() }]),
      })
    }

    return NextResponse.json(await readActivePresence())
  }catch{
    return NextResponse.json({ online:1, openTabs:1 })
  }
}
