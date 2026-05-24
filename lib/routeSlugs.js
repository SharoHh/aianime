export function decodeRouteSlug(value){
  const raw = Array.isArray(value) ? value[0] : value
  try{
    return decodeURIComponent(String(raw || ''))
  }catch{
    return String(raw || '')
  }
}

export function slugifyRu(text){
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/й/g, 'и')
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
}

export function encodeSlug(text){
  return encodeURIComponent(slugifyRu(text))
}

export function titleFromSlug(slug){
  const decoded = decodeRouteSlug(slug)
  return decoded
    .replace(/-/g, ' ')
    .replace(/^./, char => char.toUpperCase())
}
