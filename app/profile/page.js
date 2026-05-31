export const dynamic = 'force-dynamic'

import Link from 'next/link'
import ProfileAuthGateClient from '@/components/ProfileAuthGateClient'

export const metadata = {
  title: 'Профиль — AIanime',
  description: 'Личный профиль AIanime: избранное, история, оценки и синхронизация аккаунта.',
  robots: { index:false, follow:false }
}

export default function ProfilePage(){
  return <main className="page profile-page-clean">
    <div className="page-head profile-clean-page-head">
      <Link href="/">← На главную</Link>
      <h1>Профиль</h1>
      <p>Личный профиль, избранное, история, оценки и синхронизация.</p>
    </div>
    <ProfileAuthGateClient/>
  </main>
}
