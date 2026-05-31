import './globals.css'
import ToastCenter from '@/components/ToastCenter'
import RouteWarmupClient from '@/components/RouteWarmupClient'
import AccountSyncClient from '@/components/AccountSyncClient'
import SiteFooter from '@/components/SiteFooter'
import SiteInteriorHeaderClient from '@/components/SiteInteriorHeaderClient'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f7f4fb',
}

const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || 'https://aianime.ru').replace(/\/$/, '')
const siteTitle = 'AIanime — смотреть аниме онлайн на русском'
const siteDescription = 'AIanime — русскоязычный онлайн-каталог аниме с быстрым поиском, AI-подбором по настроению, расписанием выхода серий, подборками и удобным Kodik-плеером.'

export const metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'AIanime',
  title: { default: siteTitle, template: '%s | AIanime' },
  description: siteDescription,
  keywords: ['аниме онлайн', 'смотреть аниме', 'аниме на русском', 'каталог аниме', 'AI подбор аниме', 'расписание аниме', 'онгоинги'],
  alternates: { canonical: '/' },
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
    url: siteUrl,
    siteName: 'AIanime',
    type: 'website',
    locale: 'ru_RU',
    images: [{ url: '/images/ai-hero-1280.webp', width: 1280, height: 720, alt: 'AIanime — аниме онлайн на русском' }]
  },
  twitter: { card: 'summary_large_image', title: siteTitle, description: siteDescription, images: ['/images/ai-hero-1280.webp'] },
  robots: { index: true, follow: true }
}

function jsonLd(data){
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

function siteJsonLd(){
  const logo = `${siteUrl}/icon-512.png`
  return [
    {
      '@context':'https://schema.org',
      '@type':'Organization',
      name:'AIanime',
      url:siteUrl,
      logo,
      image:logo,
      sameAs:[]
    },
    {
      '@context':'https://schema.org',
      '@type':'WebSite',
      name:'AIanime',
      alternateName:'Aianime',
      url:siteUrl,
      inLanguage:'ru-RU',
      description:siteDescription,
      publisher:{ '@type':'Organization', name:'AIanime', logo:{ '@type':'ImageObject', url:logo } },
      potentialAction:{
        '@type':'SearchAction',
        target:`${siteUrl}/catalog?search={search_term_string}`,
        'query-input':'required name=search_term_string'
      }
    }
  ]
}

export default function RootLayout({ children }) {
  return <html lang="ru">
    <head>
      <meta name="theme-color" content="#f7f4fb" />
      <style dangerouslySetInnerHTML={{__html:'html{background:#f7f4fb;color-scheme:light;}body{margin:0;background:#f7f4fb;}body::selection{background:#eadcff;color:#15122d;}'}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(siteJsonLd())}} />
      <link rel="preconnect" href="https://kodikplayer.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://kodikplayer.com" />
      <link rel="preconnect" href="https://i.kodikres.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://i.kodikres.com" />
      <link rel="preconnect" href="https://cdn.myanimelist.net" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://cdn.myanimelist.net" />
    </head>
    <body><RouteWarmupClient/><AccountSyncClient/><SiteInteriorHeaderClient/>{children}<SiteFooter/><ToastCenter/></body>
  </html>
}
