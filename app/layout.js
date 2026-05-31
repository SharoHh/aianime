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

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'Aianime — anime catalog', template: '%s | Aianime' },
  description: 'Русскоязычный каталог аниме с AI-подбором, расписанием, коллекциями и онлайн-плеером.',
  openGraph: { title: 'Aianime', description: 'Русский аниме-каталог с AI-рекомендациями', type: 'website' }
}

export default function RootLayout({ children }) {
  return <html lang="ru">
    <head>
      <meta name="theme-color" content="#f7f4fb" />
      <style dangerouslySetInnerHTML={{__html:'html{background:#f7f4fb;color-scheme:light;}body{margin:0;background:#f7f4fb;}body::selection{background:#eadcff;color:#15122d;}'}} />
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
