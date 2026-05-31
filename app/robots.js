function siteUrl(){
  return String(process.env.NEXT_PUBLIC_SITE_URL || 'https://aianime.ru').replace(/\/$/, '')
}

// AIanime v131: settings route redirects to profile.
export default function robots(){
  const base = siteUrl()
  return {
    rules: {
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
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
