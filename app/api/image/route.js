export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { createHash } from 'crypto'
import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import path from 'path'

const CACHE_DIR = process.env.AIANIME_IMAGE_CACHE_DIR || '/tmp/aianime-image-cache'
const CACHE_TTL_MS = Number(process.env.AIANIME_IMAGE_DISK_CACHE_TTL_MS || 1000 * 60 * 60 * 24 * 30)
const STALE_CACHE_TTL_MS = Number(process.env.AIANIME_IMAGE_STALE_CACHE_TTL_MS || 1000 * 60 * 60 * 24 * 90)
const MAX_IMAGE_BYTES = Number(process.env.AIANIME_IMAGE_MAX_BYTES || 8 * 1024 * 1024)
const FETCH_TIMEOUT_MS = Number(process.env.AIANIME_IMAGE_FETCH_TIMEOUT_MS || 7000)

const CACHE_CONTROL = 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800, immutable'
const FALLBACK_CACHE_CONTROL = 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600'

const ALLOWED_HOSTS = [
  'cdn.myanimelist.net',
  'myanimelist.net',
  'i.kodikres.com',
  'kodikres.com',
  'shikimori.one'
]

function isAllowedRemoteImage(url){
  try{
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if(parsed.protocol !== 'https:') return false
    return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
  }catch{
    return false
  }
}

function fallbackUrl(req){
  const raw = req.nextUrl.searchParams.get('fallback') || '/posters/magic2.svg'
  const safe = String(raw).startsWith('/') && !String(raw).startsWith('//') ? String(raw) : '/posters/magic2.svg'
  return new URL(safe, req.url)
}

function fallback(req, reason = 'fallback'){
  return new Response(null, {
    status: 302,
    headers: {
      Location: fallbackUrl(req).toString(),
      'Cache-Control': FALLBACK_CACHE_CONTROL,
      'X-Aianime-Image-Proxy': '1',
      'X-Aianime-Image-Cache': reason
    }
  })
}

function cacheKey(url){
  return createHash('sha256').update(String(url)).digest('hex')
}

function imageEtag(buffer){
  return `"${createHash('sha1').update(buffer).digest('hex')}"`
}

function metaPath(key){
  return path.join(CACHE_DIR, `${key}.json`)
}

function binPath(key){
  return path.join(CACHE_DIR, `${key}.bin`)
}

function responseHeaders({ buffer, type, cacheStatus, etag, stale = false }){
  const headers = {
    'Content-Type': type || 'image/webp',
    'Content-Length': String(buffer?.byteLength || buffer?.length || 0),
    'Cache-Control': CACHE_CONTROL,
    'Content-Disposition': 'inline',
    'ETag': etag,
    'Vary': 'Accept',
    'X-Aianime-Image-Proxy': '1',
    'X-Aianime-Image-Cache': cacheStatus
  }
  if(stale) headers['X-Aianime-Image-Stale'] = '1'
  return headers
}

function notModified(headers){
  const cleanHeaders = { ...headers }
  delete cleanHeaders['Content-Length']
  delete cleanHeaders['Content-Type']
  return new Response(null, { status: 304, headers: cleanHeaders })
}

function responseFromBuffer(req, buffer, type, cacheStatus, etag, stale = false){
  const finalEtag = etag || imageEtag(buffer)
  const headers = responseHeaders({ buffer, type, cacheStatus, etag: finalEtag, stale })
  if(req?.headers?.get('if-none-match') === finalEtag) return notModified(headers)
  return new Response(buffer, { status: 200, headers })
}

async function readDiskCache(req, key, { allowStale = false } = {}){
  try{
    const [metaRaw, fileStat] = await Promise.all([readFile(metaPath(key), 'utf8'), stat(binPath(key))])
    const ageMs = Date.now() - fileStat.mtimeMs
    if(ageMs > CACHE_TTL_MS && (!allowStale || ageMs > STALE_CACHE_TTL_MS)) return null

    const meta = JSON.parse(metaRaw)
    const buffer = await readFile(binPath(key))
    const stale = ageMs > CACHE_TTL_MS
    const status = stale ? 'STALE' : 'HIT'
    return responseFromBuffer(req, buffer, meta.type, status, meta.etag, stale)
  }catch{
    return null
  }
}

async function writeDiskCache(key, buffer, type){
  try{
    await mkdir(CACHE_DIR, { recursive: true })
    await Promise.all([
      writeFile(binPath(key), buffer),
      writeFile(metaPath(key), JSON.stringify({ type, etag: imageEtag(buffer), at: new Date().toISOString() }))
    ])
  }catch{
    // Cache write failure must never break image delivery.
  }
}

async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT_MS){
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try{
    return await fetch(url, {
      signal: controller.signal,
      cache: 'force-cache',
      next: { revalidate: 60 * 60 * 24 * 30 },
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; AianimeImageProxy/1.1; +https://aianime.ru)'
      }
    })
  }finally{
    clearTimeout(timer)
  }
}

export async function GET(req){
  const url = req.nextUrl.searchParams.get('url')
  if(!url) return fallback(req, 'NO_URL')
  if(!isAllowedRemoteImage(url)) return fallback(req, 'BLOCKED_HOST')

  const key = cacheKey(url)
  const cached = await readDiskCache(req, key)
  if(cached) return cached

  try{
    const res = await fetchWithTimeout(url)
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if(!res.ok || !type.startsWith('image/')){
      const stale = await readDiskCache(req, key, { allowStale: true })
      return stale || fallback(req, 'UPSTREAM_BAD_RESPONSE')
    }

    const bytes = await res.arrayBuffer()
    if(bytes.byteLength <= 0 || bytes.byteLength > MAX_IMAGE_BYTES){
      const stale = await readDiskCache(req, key, { allowStale: true })
      return stale || fallback(req, 'UPSTREAM_BAD_SIZE')
    }

    const buffer = Buffer.from(bytes)
    await writeDiskCache(key, buffer, type)
    return responseFromBuffer(req, buffer, type, 'MISS')
  }catch{
    const stale = await readDiskCache(req, key, { allowStale: true })
    return stale || fallback(req, 'UPSTREAM_ERROR')
  }
}

export async function HEAD(req){
  const response = await GET(req)
  return new Response(null, { status: response.status, headers: response.headers })
}
