export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { createHash } from 'crypto'
import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import path from 'path'

const CACHE_DIR = process.env.AIANIME_IMAGE_CACHE_DIR || '/tmp/aianime-image-cache'
const CACHE_TTL_MS = Number(process.env.AIANIME_IMAGE_DISK_CACHE_TTL_MS || 1000 * 60 * 60 * 24 * 30)
const MAX_IMAGE_BYTES = Number(process.env.AIANIME_IMAGE_MAX_BYTES || 8 * 1024 * 1024)
const CACHE_CONTROL = 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800, immutable'

const TYPE_EXT = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg'
}

function isAllowedRemoteImage(url){
  try{
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if(parsed.protocol !== 'https:') return false
    return host === 'cdn.myanimelist.net'
      || host.endsWith('.myanimelist.net')
      || host === 'i.kodikres.com'
      || host.endsWith('.kodikres.com')
      || host === 'shikimori.one'
      || host.endsWith('.shikimori.one')
  }catch{
    return false
  }
}

function fallbackUrl(req){
  const raw = req.nextUrl.searchParams.get('fallback') || '/posters/magic2.svg'
  const safe = String(raw).startsWith('/') && !String(raw).startsWith('//') ? String(raw) : '/posters/magic2.svg'
  return new URL(safe, req.url)
}

function fallback(req){
  return Response.redirect(fallbackUrl(req), 302)
}

function cacheKey(url){
  return createHash('sha256').update(String(url)).digest('hex')
}

function metaPath(key){
  return path.join(CACHE_DIR, `${key}.json`)
}

function binPath(key){
  return path.join(CACHE_DIR, `${key}.bin`)
}

function responseFromBuffer(buffer, type, cacheStatus){
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': type || 'image/webp',
      'Content-Length': String(buffer.byteLength || buffer.length || 0),
      'Cache-Control': CACHE_CONTROL,
      'X-Aianime-Image-Proxy': '1',
      'X-Aianime-Image-Cache': cacheStatus
    }
  })
}

async function readDiskCache(key){
  try{
    const [metaRaw, fileStat] = await Promise.all([readFile(metaPath(key), 'utf8'), stat(binPath(key))])
    if(Date.now() - fileStat.mtimeMs > CACHE_TTL_MS) return null
    const meta = JSON.parse(metaRaw)
    const buffer = await readFile(binPath(key))
    return responseFromBuffer(buffer, meta.type, 'HIT')
  }catch{
    return null
  }
}

async function writeDiskCache(key, buffer, type){
  try{
    await mkdir(CACHE_DIR, { recursive: true })
    await Promise.all([
      writeFile(binPath(key), buffer),
      writeFile(metaPath(key), JSON.stringify({ type, at: new Date().toISOString() }))
    ])
  }catch{
    // Cache write failure must never break image delivery.
  }
}

async function fetchWithTimeout(url, timeout = 9000){
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try{
    return await fetch(url, {
      signal: controller.signal,
      cache: 'force-cache',
      next: { revalidate: 60 * 60 * 24 * 30 },
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; AianimeImageProxy/1.0; +https://aianime.ru)'
      }
    })
  }finally{
    clearTimeout(timer)
  }
}

export async function GET(req){
  const url = req.nextUrl.searchParams.get('url')
  if(!url) return fallback(req)
  if(!isAllowedRemoteImage(url)) return fallback(req)

  const key = cacheKey(url)
  const cached = await readDiskCache(key)
  if(cached) return cached

  try{
    const res = await fetchWithTimeout(url)
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if(!res.ok || !type.startsWith('image/')) return fallback(req)

    const bytes = await res.arrayBuffer()
    if(bytes.byteLength <= 0 || bytes.byteLength > MAX_IMAGE_BYTES) return fallback(req)

    const buffer = Buffer.from(bytes)
    await writeDiskCache(key, buffer, type)
    return responseFromBuffer(buffer, type, 'MISS')
  }catch{
    return fallback(req)
  }
}
