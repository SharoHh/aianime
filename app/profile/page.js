export const dynamic = 'force-dynamic'

import Link from 'next/link'
import ProfileEditorClient from '@/components/ProfileEditorClient'
import AccountSyncClient from '@/components/AccountSyncClient'

export const metadata = {
  title: 'Профиль — Aianime',
  description: 'Настройки профиля, аватар, фон и синхронизация аккаунта.'
}

export default function ProfilePage(){
  return <main className="page profile-page-clean">
    <div className="page-head profile-clean-page-head">
      <Link href="/">← На главную</Link>
      <h1>Профиль</h1>
      <p>Настрой внешний вид профиля и синхронизацию аккаунта.</p>
    </div>
    <ProfileEditorClient/>
    <AccountSyncClient/>
  </main>
}
