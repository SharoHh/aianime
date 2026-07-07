export const dynamic = 'force-dynamic'

import Link from 'next/link'
import AuthCallbackClient from './AuthCallbackClient'

export const metadata = {
  title:'Завершение входа — AIanime',
  robots:{ index:false, follow:false }
}

export default function AuthCallbackPage(){
  return <main className="page auth-page auth-callback-page">
    <div className="page-head"><Link href="/">← На главную</Link><h1>Завершаем вход</h1><p>Проверяем защищённый ответ сервиса авторизации.</p></div>
    <AuthCallbackClient/>
  </main>
}
