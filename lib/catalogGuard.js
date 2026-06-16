import { isVercelBuildTime } from '@/lib/supabaseServer'

const DEFAULT_MIN_PRODUCTION_CATALOG_SIZE = 500

function envFlag(name, defaultValue = false){
  const value = process.env[name]
  if(value === undefined || value === null || value === '') return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
}

export function minProductionCatalogSize(){
  const value = Number(process.env.AIANIME_MIN_PRODUCTION_CATALOG_SIZE || DEFAULT_MIN_PRODUCTION_CATALOG_SIZE)
  if(!Number.isFinite(value) || value < 1) return DEFAULT_MIN_PRODUCTION_CATALOG_SIZE
  return Math.max(100, Math.min(value, 1200))
}

export function isProductionRuntime(){
  return process.env.NODE_ENV === 'production' && !isVercelBuildTime()
}

export function isSeedCatalogFallbackAllowed(){
  if(envFlag('AIANIME_ALLOW_SEED_FALLBACK', false)) return true
  // На build/dev seed нужен, чтобы Next.js мог собрать страницы без походов в Supabase.
  // На production runtime seed-40 запрещён: лучше пустой/degraded state, чем фейковый каталог.
  return !isProductionRuntime()
}

export function isCatalogGuardEnabled(){
  return isProductionRuntime() && !isSeedCatalogFallbackAllowed()
}

export function isUnsafeProductionCatalogCount(count, requestedLimit = 1200){
  if(!isCatalogGuardEnabled()) return false
  const total = Number(count || 0)
  const limit = Number(requestedLimit || 0)
  const min = minProductionCatalogSize()

  // Если сознательно запросили маленькую витрину (например limit=80), по ней нельзя понять общий размер базы.
  if(limit > 0 && limit < min) return false
  return total < min
}

export function catalogGuardReason(count, requestedLimit = 1200){
  const total = Number(count || 0)
  const min = minProductionCatalogSize()
  if(!isCatalogGuardEnabled()) return null
  if(isUnsafeProductionCatalogCount(total, requestedLimit)){
    return `production catalog guard: anime count ${total} below minimum ${min}`
  }
  return null
}
