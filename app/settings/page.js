export const dynamic = 'force-dynamic'

import Link from 'next/link'
import SettingsClient from './SettingsClient'

export const metadata = {
  title: 'Настройки — Aianime',
  description: 'Настройки аккаунта, уведомлений и AI-рекомендаций.'
}

export default function SettingsPage(){
  return <main className="page">
    <div className="page-head"><Link href="/">← На главную</Link><h1>Настройки</h1><p>Настройки аккаунта, уведомлений и персонализации AI.</p></div>
    <SettingsClient/>
  </main>
}
