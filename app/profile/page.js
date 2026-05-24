export const dynamic = 'force-dynamic'

import Link from 'next/link'
import ProfileAuthGateClient from '@/components/ProfileAuthGateClient'

export const metadata = {
  title: 'Профиль — Aianime',
  description: 'Профиль Aianime, аватар, фон и синхронизация аккаунта.'
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
