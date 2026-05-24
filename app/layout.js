import './globals.css'
import ToastCenter from '@/components/ToastCenter'


export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'Aianime — anime catalog', template: '%s | Aianime' },
  description: 'Pastel anime catalog with AI recommendations, schedules, collections and watch pages.',
  openGraph: { title: 'Aianime', description: 'Anime catalog with AI recommendations', type: 'website' }
}

export default function RootLayout({ children }) {
  return <html lang="ru"><body>{children}<ToastCenter/></body></html>
}
