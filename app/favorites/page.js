export const dynamic = 'force-dynamic'

import Link from 'next/link'
import LocalAnimeList from '@/components/LocalAnimeList'
import AuthRequiredClient from '@/components/AuthRequiredClient'

export const metadata = {
  title: 'Избранное — AIanime',
  description: 'Личный список избранных аниме в профиле AIanime.',
  robots: { index:false, follow:false }
}
