const fs = require('fs')
const path = require('path')

function stripQuotes(value){
  const text = String(value || '').trim()
  if((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))){
    return text.slice(1, -1)
  }
  return text
}

function parseEnvFile(filePath){
  const env = {}
  if(!fs.existsSync(filePath)) return env
  const raw = fs.readFileSync(filePath, 'utf8')
  for(const lineRaw of raw.split(/\r?\n/)){
    const line = lineRaw.trim()
    if(!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if(eq <= 0) continue
    const key = line.slice(0, eq).trim().replace(/^export\s+/, '')
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    env[key] = stripQuotes(line.slice(eq + 1))
  }
  return env
}

function loadFileEnv(){
  const root = __dirname
  const mode = process.env.NODE_ENV || 'production'
  const files = [
    '.env',
    `.env.${mode}`,
    '.env.local',
    `.env.${mode}.local`,
    '.env.production',
    '.env.production.local'
  ]
  const out = {}
  for(const name of files){
    Object.assign(out, parseEnvFile(path.join(root, name)))
  }
  return out
}

const fileEnv = loadFileEnv()

module.exports = {
  apps: [
    {
      name: 'aianime',
      cwd: __dirname,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 127.0.0.1 -p 3000',
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      time: true,
      max_memory_restart: '900M',
      env: {
        ...fileEnv,
        NODE_ENV: 'production',
        PORT: '3000',
        HOSTNAME: '127.0.0.1'
      }
    }
  ]
}
