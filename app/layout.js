import './globals.css'
import ToastCenter from '@/components/ToastCenter'
import RouteWarmupClient from '@/components/RouteWarmupClient'
import AccountSyncClient from '@/components/AccountSyncClient'
import SiteFooter from '@/components/SiteFooter'
import SiteInteriorHeaderClient from '@/components/SiteInteriorHeaderClient'
import PosterFailureGuard from '@/components/PosterFailureGuard'
import MobileBottomNavClient from '@/components/MobileBottomNavClient'
import GlobalSearchOverlay from '@/components/GlobalSearchOverlay'
import { SITE_NAME, SITE_URL, DEFAULT_OG_IMAGE, siteUrl, jsonLd } from '@/lib/seo'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f7f4fb',
}

const siteTitle = 'AIanime — смотреть аниме онлайн на русском'
const siteDescription = 'AIanime — аниме онлайн на русском: каталог тайтлов, AI-подбор по настроению, расписание выхода серий, подборки, рейтинги, избранное и удобный Kodik-плеер.'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  title: { default: siteTitle, template: '%s | AIanime' },
  description: siteDescription,
  keywords: [
    'аниме онлайн',
    'смотреть аниме онлайн',
    'аниме на русском',
    'каталог аниме',
    'онгоинги аниме',
    'расписание аниме',
    'AI подбор аниме',
    'аниме с озвучкой',
    'аниме бесплатно онлайн'
  ],
  alternates: { canonical: '/' },
  category: 'entertainment',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' }
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }]
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: 'website',
    locale: 'ru_RU',
    images: [{ url: DEFAULT_OG_IMAGE, width: 1280, height: 720, alt: 'AIanime — аниме онлайн на русском' }]
  },
  twitter: { card: 'summary_large_image', title: siteTitle, description: siteDescription, images: [DEFAULT_OG_IMAGE] },
  robots: {
    index: true,
    follow: true,
    googleBot: { index:true, follow:true, 'max-image-preview':'large', 'max-snippet':-1, 'max-video-preview':-1 }
  }
}

function siteJsonLd(){
  const logo = siteUrl('/icon-512.png')
  return [
    {
      '@context':'https://schema.org',
      '@type':'Organization',
      name:SITE_NAME,
      alternateName:'Aianime',
      url:SITE_URL,
      logo:{ '@type':'ImageObject', url:logo, width:512, height:512 },
      image:logo
    },
    {
      '@context':'https://schema.org',
      '@type':'WebSite',
      name:SITE_NAME,
      alternateName:'Aianime',
      url:SITE_URL,
      inLanguage:'ru-RU',
      description:siteDescription,
      publisher:{ '@type':'Organization', name:SITE_NAME, logo:{ '@type':'ImageObject', url:logo } },
      potentialAction:{
        '@type':'SearchAction',
        target:`${SITE_URL}/catalog?search={search_term_string}`,
        'query-input':'required name=search_term_string'
      }
    },
    {
      '@context':'https://schema.org',
      '@type':'WebApplication',
      name:SITE_NAME,
      url:SITE_URL,
      applicationCategory:'EntertainmentApplication',
      operatingSystem:'Web',
      inLanguage:'ru-RU',
      description:siteDescription,
      offers:{ '@type':'Offer', price:'0', priceCurrency:'RUB' }
    }
  ]
}

export default function RootLayout({ children }) {
  return <html lang="ru">
    <head>
      <meta name="theme-color" content="#f7f4fb" />
      <meta name="format-detection" content="telephone=no" />
      <style dangerouslySetInnerHTML={{__html:'html{background:#f7f4fb;color-scheme:light;}body{margin:0;background:#f7f4fb;}body::selection{background:#eadcff;color:#15122d;}'}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(siteJsonLd())}} />
      <link rel="preconnect" href="https://kodikplayer.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://kodikplayer.com" />
      <link rel="preconnect" href="https://i.kodikres.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://i.kodikres.com" />
      <link rel="preconnect" href="https://cdn.myanimelist.net" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://cdn.myanimelist.net" />
      <link rel="preconnect" href="https://shikimori.one" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://shikimori.one" />
    </head>
    <body><RouteWarmupClient/><AccountSyncClient/><PosterFailureGuard/><GlobalSearchOverlay global/><SiteInteriorHeaderClient/>{children}<SiteFooter/><MobileBottomNavClient/><ToastCenter/></body>
  </html>
}
