import fs from 'fs'
import path from 'path'

const state = globalThis.__AIANIME_RUNTIME_ENV_LOADER__ || { loaded:false }
globalThis.__AIANIME_RUNTIME_ENV_LOADER__ = state

function stripQuotes(value = ''){
  const text = String(value || '').trim()
  if((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))){
    return text.slice(1, -1)
  }
  return text
}

function parseEnvFile(filePath){
  const out = {}
  let raw = ''
  try{ raw = fs.readFileSync(filePath, 'utf8') }catch{ return out }
  for(const lineRaw of raw.split(/\r?\n/)){
    const line = lineRaw.trim()
    if(!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if(eq <= 0) continue
    const key = line.slice(0, eq).trim().replace(/^export\s+/, '')
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    out[key] = stripQuotes(line.slice(eq + 1))
  }
  return out
}

export function loadRuntimeEnv(){
  if(typeof window !== 'undefined') return false
  if(state.loaded) return true
  state.loaded = true

  const root = process.cwd()
  const mode = process.env.NODE_ENV || 'production'
  const files = [
    '.env',
    `.env.${mode}`,
    '.env.local',
    `.env.${mode}.local`,
    '.env.production',
    '.env.production.local'
  ]

  for(const name of files){
    const filePath = path.join(root, name)
    const values = parseEnvFile(filePath)
    for(const [key, value] of Object.entries(values)){
      // Later files override earlier values, but missing keys in .env.production
      // do not wipe Supabase keys loaded from .env.local.
      if(value !== undefined && value !== null && String(value).length){
        process.env[key] = String(value)
      }
    }
  }
  return true
}

loadRuntimeEnv()
