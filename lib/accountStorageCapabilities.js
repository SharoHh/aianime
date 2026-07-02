/**
 * Safe account-storage capability map.
 *
 * Cloud tables for history/library are not guaranteed to exist in the
 * currently deployed Supabase schema. Returning a conservative map keeps
 * account data in localStorage and prevents repeated 400/404 requests from
 * blocking the rest of the site.
 */
const SAFE_CAPABILITIES = Object.freeze({
  favorites: false,
  history: false,
  ratings: false,
  library: false,
  aiHistory: false,
})

export async function getAccountStorageCapabilities(){
  return SAFE_CAPABILITIES
}
