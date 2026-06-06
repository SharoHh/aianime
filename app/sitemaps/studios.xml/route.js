import { getAnimeList } from '@/lib/animeRepository'
import { buildSitemapUrlset, buildStudioSitemapEntries, xmlResponse } from '@/lib/sitemapSeo'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

export async function GET(){
  const anime = await getAnimeList({ limit: 1200 })
  return xmlResponse(buildSitemapUrlset(buildStudioSitemapEntries(anime)))
}
