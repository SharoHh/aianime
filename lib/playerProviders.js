import { hasKodik, normalizeKodikPlayerUrl, resolveKodikPlayerForAnime } from '@/lib/kodik'

function storedKodikProvider(anime){
  const embedUrl = normalizeKodikPlayerUrl(
    anime?.kodikLink ||
    anime?.kodik_link ||
    anime?.kodik_link_url ||
    anime?.embed_url
  )

  if(!embedUrl) return null

  return {
    provider: 'kodik',
    title: anime?.titleRu || anime?.title_ru || anime?.title || 'Kodik',
    episodes: anime?.episodesList || [1],
    embed_url: embedUrl,
    quality: anime?.quality ? [anime.quality] : [],
    voices: anime?.translationTitle || anime?.translation_title ? [anime.translationTitle || anime.translation_title] : ['Kodik'],
    raw: {
      source: 'stored-kodik-link',
      kodik_id: anime?.kodikId || anime?.kodik_id || null,
      kodik_link: embedUrl,
      translation_title: anime?.translationTitle || anime?.translation_title || null,
      translation_type: anime?.translationType || anime?.translation_type || null,
      quality: anime?.quality || null
    }
  }
}

export const playerProviders = [
  {
    id: 'kodik',
    name: 'Kodik',
    get enabled(){ return hasKodik() },
    async search(anime, options = {}){
      // Основной путь: используем уже сохранённую Kodik embed/link из Supabase.
      // Так player sync не делает внешний запрос на Kodik для каждого тайтла.
      const stored = storedKodikProvider(anime)
      if(stored) return [stored]

      // Внешний runtime-resolve — только по явному флагу.
      // Иначе плеер должен ждать sync-kodik, который заполнит anime.kodik_link.
      if(!options.allowExternal) return []

      const player = await resolveKodikPlayerForAnime(anime, { limit: 5 })
      if(!player?.embedUrl) return []
      return [{
        provider: 'kodik',
        title: player.title || anime.title,
        episodes: anime.episodesList || [1],
        embed_url: player.embedUrl,
        quality: player.quality ? [player.quality] : [],
        voices: player.translationTitle ? [player.translationTitle] : ['Kodik'],
        raw: player.raw || player
      }]
    }
  },
  {
    id: 'demo',
    name: 'Demo Provider',
    enabled: process.env.ENABLE_DEMO_PLAYER === '1',
    async search(anime){
      return [{
        provider: 'demo',
        title: anime.title,
        episodes: anime.episodesList || [1],
        embed_url: `/anime/${anime.slug}#player`,
        quality: ['720p','1080p'],
        voices: ['Demo voice']
      }]
    }
  }
]

export async function resolvePlayers(anime, options = {}){
  const results = []
  for(const provider of playerProviders.filter(p=>p.enabled)){
    try {
      results.push(...await provider.search(anime, options))
    } catch(error){
      results.push({ provider: provider.id, error: error?.message || String(error) })
    }
  }
  return results
}
