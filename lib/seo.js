// AIanime v145: shared SEO helpers for canonical URLs, metadata and Schema.org without UI changes.
export const SITE_NAME = 'AIanime'
export const SITE_URL = String(process.env.NEXT_PUBLIC_SITE_URL || 'https://aianime.ru').replace(/\/$/, '')
export const DEFAULT_OG_IMAGE = '/images/ai-hero-1280.webp'

export function siteUrl(path = ''){
  const value = String(path || '')
  if(!value) return SITE_URL
  if(/^https?:\/\//i.test(value)) return value
  return `${SITE_URL}${value.startsWith('/') ? value : `/${value}`}`
}

export function jsonLd(data){
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function cleanSeoText(value){
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function truncateSeo(value, max = 158){
  const text = cleanSeoText(value)
  if(text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 1)).replace(/[\s,.;:!?-]+$/g, '')}…`
}

export function buildPageMetadata({ title, description, path = '/', image = DEFAULT_OG_IMAGE, type = 'website', index = true, keywords = [] } = {}){
  const safeTitle = cleanSeoText(title || SITE_NAME)
  const safeDescription = truncateSeo(description || 'AIanime — аниме онлайн на русском: каталог тайтлов, подборки, расписание выхода серий, AI-рекомендации и удобный онлайн-плеер.')
  const canonical = path || '/'
  const imageUrl = image ? siteUrl(image) : siteUrl(DEFAULT_OG_IMAGE)

  return {
    title: safeTitle,
    description: safeDescription,
    keywords,
    alternates: { canonical },
    robots: index
      ? { index:true, follow:true, googleBot:{ index:true, follow:true, 'max-image-preview':'large', 'max-snippet':-1, 'max-video-preview':-1 } }
      : { index:false, follow:false, googleBot:{ index:false, follow:false } },
    openGraph: {
      title: safeTitle,
      description: safeDescription,
      url: canonical,
      siteName: SITE_NAME,
      type,
      locale: 'ru_RU',
      images: imageUrl ? [{ url:imageUrl, width:1280, height:720, alt:safeTitle }] : []
    },
    twitter: { card:'summary_large_image', title:safeTitle, description:safeDescription, images:imageUrl ? [imageUrl] : [] }
  }
}

export function breadcrumbJsonLd(items = []){
  return {
    '@context':'https://schema.org',
    '@type':'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type':'ListItem',
      position:index + 1,
      name:item.name,
      item:siteUrl(item.url || '/')
    }))
  }
}

export function collectionPageJsonLd({ name, description, path = '/', items = [] } = {}){
  return {
    '@context':'https://schema.org',
    '@type':'CollectionPage',
    name:cleanSeoText(name),
    description:truncateSeo(description, 220),
    url:siteUrl(path),
    inLanguage:'ru-RU',
    isPartOf:{ '@type':'WebSite', name:SITE_NAME, url:SITE_URL },
    mainEntity: items.length ? {
      '@type':'ItemList',
      numberOfItems:items.length,
      itemListElement:items.slice(0, 24).map((item, index) => ({
        '@type':'ListItem',
        position:index + 1,
        url:siteUrl(item.url || `/anime/${item.slug || ''}`),
        name:cleanSeoText(item.name || item.title || '')
      }))
    } : undefined
  }
}

export function animeListJsonLd(items = [], path = '/'){
  return collectionPageJsonLd({
    name:'Каталог аниме AIanime',
    description:'Русскоязычный каталог аниме с онлайн-просмотром, рейтингами, подборками и расписанием выхода серий.',
    path,
    items:items.map(item => ({ title:item.title, slug:item.slug, url:`/anime/${encodeURIComponent(item.slug || '')}` }))
  })
}
