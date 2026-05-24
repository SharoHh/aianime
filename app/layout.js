import './globals.css'
import ToastCenter from '@/components/ToastCenter'


export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'Aianime — anime catalog', template: '%s | Aianime' },
  description: 'Русскоязычный каталог аниме с AI-подбором, расписанием, коллекциями и онлайн-плеером.',
  openGraph: { title: 'Aianime', description: 'Русский аниме-каталог с AI-рекомендациями', type: 'website' }
}

export default function RootLayout({ children }) {
  return <html lang="ru"><body>{children}<ToastCenter/></body></html>
}
