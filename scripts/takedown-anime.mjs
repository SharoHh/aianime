#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(file){
  if(!fs.existsSync(file)) return
  const text = fs.readFileSync(file, 'utf8')
  for(const rawLine of text.split(/\r?\n/)){
    const line = rawLine.trim()
    if(!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if(index <= 0) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if(!process.env[key]) process.env[key] = value
  }
}

for(const name of ['.env', '.env.local', '.env.production']) loadEnvFile(path.resolve(process.cwd(), name))

const slug = String(process.argv[2] || '').trim()
if(!slug){
  console.error('Usage: node scripts/takedown-anime.mjs <slug>')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
if(!url || !key){
  console.error('SUPABASE URL or service role key is missing')
  process.exit(1)
}

const supabase = createClient(url, key, { auth:{ persistSession:false, autoRefreshToken:false } })
const dependentTables = [
  'anime_episodes',
  'anime_schedule',
  'anime_comments',
  'player_reports',
  'anime_popularity_events',
  'user_history',
  'user_favorites',
  'user_ratings',
  'user_anime_library',
]

console.log(`Takedown: ${slug}`)
for(const table of dependentTables){
  const { error, count } = await supabase.from(table).delete({ count:'exact' }).eq('anime_slug', slug)
  if(error){
    console.log(`SKIP ${table}: ${error.message}`)
  }else{
    console.log(`DELETE ${table}: ${count ?? 'ok'}`)
  }
}

for(const table of ['anime', 'anime_titles']){
  const { error, count } = await supabase.from(table).delete({ count:'exact' }).eq('slug', slug)
  if(error){
    console.log(`SKIP ${table}: ${error.message}`)
  }else{
    console.log(`DELETE ${table}: ${count ?? 'ok'}`)
  }
}

console.log('DONE')
