// AIanime v245: centralized legal/content takedown restrictions.
// Keep this module dependency-free because it is imported by the Next.js edge proxy.

const RESTRICTED_ANIME = new Map([
  ['513-tenkuu-no-shiro-laputa', {
    status: 410,
    title: 'Контент недоступен',
    message: 'Этот материал удалён и недоступен на сайте.',
    reason: 'content-restriction',
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

export function getRestrictedAnimeInfo(value){
  return RESTRICTED_ANIME.get(normalizeAnimeSlug(value)) || null
}

export function isRestrictedAnimeSlug(value){
  return Boolean(getRestrictedAnimeInfo(value))
}

export function filterRestrictedAnime(items){
  return Array.isArray(items) ? items.filter(item => !isRestrictedAnimeSlug(item?.slug || item?.anime_slug)) : []
}

export function restrictedAnimeSlugs(){
  return Array.from(RESTRICTED_ANIME.keys())
}
