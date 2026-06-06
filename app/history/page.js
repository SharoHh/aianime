export const dynamic = 'force-dynamic'

import Link from 'next/link'
import LocalAnimeList from '@/components/LocalAnimeList'
import AuthRequiredClient from '@/components/AuthRequiredClient'

export const metadata = {
  title: 'История просмотра — AIanime',
  description: 'Личная история просмотра аниме в профиле AIanime.',
  robots: { index:false, follow:false }
}
