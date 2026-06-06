// AIanime v146: sitemap index that points crawlers to split sitemap files.
import { getAnimeList } from '@/lib/animeRepository'
import { SITE_URL } from '@/lib/seo'
import { SITEMAP_CHUNK_SIZE, buildSitemapIndex, latestLastModified, xmlResponse, isPublicAnimeForSitemap } from '@/lib/sitemapSeo'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

export async function GET(){
  const anime = await getAnimeList({ limit: 1200 })
  const publicAnime = anime.filter(isPublicAnimeForSitemap)
  const latest = latestLastModified(publicAnime)
  const chunkCount = Math.max(1, Math.ceil(publicAnime.length / SITEMAP_CHUNK_SIZE))
  const entries = [
    { loc:`${SITE_URL}/sitemaps/static.xml`, lastmod:latest },
    ...Array.from({ length:Math.min(chunkCount, 3) }, (_, index) => ({ loc:`${SITE_URL}/sitemaps/anime-${index + 1}.xml`, lastmod:latest })),
    { loc:`${SITE_URL}/sitemaps/genres.xml`, lastmod:latest },
    { loc:`${SITE_URL}/sitemaps/studios.xml`, lastmod:latest },
  ]

  return xmlResponse(buildSitemapIndex(entries))
}
