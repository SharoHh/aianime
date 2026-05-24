export const dynamic = 'force-dynamic'

import Link from 'next/link'
import AuthClient from './AuthClient'

export const metadata = {
  title: 'Вход — Aianime',
  description: 'Вход и регистрация в профиле Aianime.'
}

export default function AuthPage(){
  return <main className="page auth-page">
    <div className="page-head"><Link href="/">← На главную</Link><h1>Вход в профиль</h1><p>Сохраняй избранное, историю, оценки и AI-запросы между устройствами.</p></div>
    <AuthClient/>
  </main>
}
