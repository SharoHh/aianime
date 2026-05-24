import './globals.css'
import ToastCenter from '@/components/ToastCenter'

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'Aianime — anime catalog', template: '%s | Aianime' },
  description: 'Русскоязычный каталог аниме с AI-подбором, расписанием, коллекциями и онлайн-плеером.',
  openGraph: { title: 'Aianime', description: 'Русский аниме-каталог с AI-рекомендациями', type: 'website' }
}

export default function RootLayout({ children }) {
  return <html lang="ru">
    <head>
      <link rel="preconnect" href="https://kodikplayer.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://kodikplayer.com" />
      <link rel="preconnect" href="https://i.kodikres.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://i.kodikres.com" />
      <link rel="preconnect" href="https://cdn.myanimelist.net" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://cdn.myanimelist.net" />
    </head>
    <body>{children}<ToastCenter/></body>
  </html>
}
