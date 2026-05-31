import { SITE_URL } from '@/lib/seo'

// AIanime v145: SEO robots rules for public indexable pages and private/internal areas.
export default function robots(){
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/api',
          '/api/',
          '/auth',
          '/profile',
          '/favorites',
          '/history',
          '/notifications',
          '/settings',
          '/collection',
          '/collections-old',
          '/recommend',
          '/recommendations',
          '/podbor',
          '/podborki',
          '/ai-podbor',
          '/ai-podborki',
          '/*?*token=',
          '/*?*debug=',
          '/*?*refresh=',
          '/*?*admin_secret=',
          '/*?*enable='
        ],
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
