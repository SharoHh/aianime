const fs = require('fs')
const path = require('path')

function parseEnvFile(filePath){
  const env = {}
  if(!fs.existsSync(filePath)) return env

  const content = fs.readFileSync(filePath, 'utf8')
  for(const rawLine of content.split(/\r?\n/)){
    let line = rawLine.trim()
    if(!line || line.startsWith('#')) continue
    if(line.startsWith('export ')) line = line.slice(7).trim()

    const eqIndex = line.indexOf('=')
    if(eqIndex <= 0) continue

    const key = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue

    const quote = value[0]
    if((quote === '"' || quote === "'") && value[value.length - 1] === quote){
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

function loadRuntimeEnv(){
  const root = __dirname
  // Важно: .env.local хранит реальные Supabase/Kodik ключи на VPS,
  // .env.production может добавлять/переопределять AI-настройки.
  return {
    ...parseEnvFile(path.join(root, '.env')),
    ...parseEnvFile(path.join(root, '.env.local')),
    ...parseEnvFile(path.join(root, '.env.production')),
  }
}

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
        ...loadRuntimeEnv(),
        NODE_ENV: 'production',
        PORT: '3000',
        HOSTNAME: '127.0.0.1'
      }
    }
  ]
}
