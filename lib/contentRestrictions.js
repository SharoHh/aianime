// AIanime v246: centralized static + database-backed regional restrictions.
// This module stays dependency-free because proxy.js imports it in the Edge runtime.

const DEFAULT_RESTRICTION = Object.freeze({
  blocked: true,
  region: 'RU',
  status: 451,
  title: 'Недоступно в РФ',
  message: 'Этот тайтл недоступен для просмотра на территории Российской Федерации.',
  reason: 'regional-restriction',
})

const STATIC_RESTRICTED_ANIME = new Map([
  ['513-tenkuu-no-shiro-laputa', {
    ...DEFAULT_RESTRICTION,
    reason: 'rkn-notice',
  }],
])

export function normalizeAnimeSlug(value = ''){
  let slug = String(value || '').trim()
  try{ slug = decodeURIComponent(slug) }catch{}
  slug = slug.replace(/^https?:\/\/[^/]+/i, '')
  slug = slug.split('?')[0].split('#')[0]
  slug = slug.replace(/^\/+|\/+$/g, '')
  if(slug.startsWith('anime/')) slug = slug.slice('anime/'.length)
  return slug.toLowerCase()
}

function clean(value){
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function asBoolean(value){
  if(value === true || value === 1) return true
  if(value === false || value === 0 || value === null) return false
  const text = String(value || '').trim().toLowerCase()
  return ['1','true','yes','on','blocked','restricted'].includes(text)
}

export function readAnimeRestrictionState(item = null){
  if(!item || typeof item !== 'object') return { configured:false, info:null }

  const raw = item.raw && typeof item.raw === 'object' ? item.raw : {}
  const hasOwnRaw = Object.prototype.hasOwnProperty.call(raw, 'aianime_restriction')
  const hasOwnDirect = Object.prototype.hasOwnProperty.call(item, 'restriction') && item.restriction && typeof item.restriction === 'object'
  const record = hasOwnDirect ? item.restriction : hasOwnRaw ? raw.aianime_restriction : null

  if(!hasOwnDirect && !hasOwnRaw) return { configured:false, info:null }
  if(!record || typeof record !== 'object') return { configured:true, info:null }

  const blocked = asBoolean(record.blocked ?? record.enabled ?? record.restricted)
  if(!blocked) return { configured:true, info:null }

  const status = Number(record.status || record.httpStatus || DEFAULT_RESTRICTION.status)
  const slug = normalizeAnimeSlug(item.slug || item.anime_slug || '')
  return {
    configured:true,
    info:{
      ...DEFAULT_RESTRICTION,
      ...record,
      blocked:true,
      slug,
      region:clean(record.region || DEFAULT_RESTRICTION.region).toUpperCase() || 'RU',
      status:Number.isFinite(status) && status >= 400 ? status : DEFAULT_RESTRICTION.status,
      title:clean(record.title || DEFAULT_RESTRICTION.title),
      message:clean(record.message || DEFAULT_RESTRICTION.message),
      reason:clean(record.reason || DEFAULT_RESTRICTION.reason),
    }
  }
}

export function getAnimeRestriction(itemOrSlug){
  if(itemOrSlug && typeof itemOrSlug === 'object'){
    const state = readAnimeRestrictionState(itemOrSlug)
    if(state.configured) return state.info
    const slug = normalizeAnimeSlug(itemOrSlug.slug || itemOrSlug.anime_slug || '')
    const status = clean(itemOrSlug.rawStatus || itemOrSlug.status).toLowerCase()
    if(['restricted_ru','blocked_ru','unavailable_ru'].includes(status)){
      return { ...DEFAULT_RESTRICTION, slug, original_status:clean(itemOrSlug.originalStatus || '') || null }
    }
    const staticInfo = STATIC_RESTRICTED_ANIME.get(slug)
    return staticInfo ? { ...DEFAULT_RESTRICTION, ...staticInfo, slug } : null
  }

  const slug = normalizeAnimeSlug(itemOrSlug)
  const staticInfo = STATIC_RESTRICTED_ANIME.get(slug)
  return staticInfo ? { ...DEFAULT_RESTRICTION, ...staticInfo, slug } : null
}

export function getRestrictedAnimeInfo(value){
  return getAnimeRestriction(value)
}

export function isAnimeRestricted(value){
  return Boolean(getAnimeRestriction(value))
}

// For callers that only have a slug this checks the emergency/static blocklist.
export function isRestrictedAnimeSlug(value){
  return Boolean(getAnimeRestriction(value))
}

export function filterRestrictedAnime(items){
  return Array.isArray(items) ? items.filter(item => !isAnimeRestricted(item)) : []
}

export function restrictedAnimeSlugs(){
  return Array.from(STATIC_RESTRICTED_ANIME.keys())
}

export function makeAnimeRestriction({ blocked = true, message = '', reason = '', region = 'RU', originalStatus = '' } = {}){
  return {
    blocked:Boolean(blocked),
    region:clean(region || 'RU').toUpperCase() || 'RU',
    status:451,
    title:'Недоступно в РФ',
    message:clean(message || DEFAULT_RESTRICTION.message),
    reason:clean(reason || DEFAULT_RESTRICTION.reason),
    original_status:clean(originalStatus || '') || null,
    updated_at:new Date().toISOString(),
  }
}
