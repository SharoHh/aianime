'use client'

export function getAdminSecret(){
  if(typeof window === 'undefined') return ''
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('admin_secret') || params.get('secret') || ''
  if(fromUrl){
    window.localStorage.setItem('aianime_admin_secret', fromUrl)
    document.cookie = `aianime_admin=${encodeURIComponent(fromUrl)}; path=/admin; max-age=43200; SameSite=Lax`
    document.cookie = `aianime_admin_api=${encodeURIComponent(fromUrl)}; path=/admin; max-age=43200; SameSite=Lax`
    return fromUrl
  }
  return window.localStorage.getItem('aianime_admin_secret') || ''
}

export async function adminFetch(path, options = {}){
  const secret = getAdminSecret()
  const join = path.includes('?') ? '&' : '?'
  const url = secret ? `${path}${join}admin_secret=${encodeURIComponent(secret)}` : path
  const res = await fetch(url, {
    ...options,
    cache: 'no-store',
    credentials: 'include',
    headers: {
      ...(options.body ? { 'content-type':'application/json' } : {}),
      ...(options.headers || {}),
      ...(secret ? { 'x-admin-secret': secret } : {}),
    }
  })
  const text = await res.text()
  let data = null
  try{ data = text ? JSON.parse(text) : null }catch{ data = { ok:false, error:text || res.statusText } }
  if(!res.ok || data?.ok === false){
    throw new Error(data?.error || res.statusText || 'Admin request failed')
  }
  return data
}

export function openAdminWithSecret(path = '/admin'){
  const secret = getAdminSecret()
  return secret ? `${path}${path.includes('?') ? '&' : '?'}admin_secret=${encodeURIComponent(secret)}` : path
}
