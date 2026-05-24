export const dynamic = 'force-dynamic'

import Link from 'next/link'

export const metadata = {
  title: 'Настройки — Aianime',
  description: 'Настройки будущего аккаунта, уведомлений и AI-рекомендаций.'
}

export default function SettingsPage(){
  return <main className="page">
    <div className="page-head"><Link href="/">← На главную</Link><h1>Настройки</h1><p>Раздел подготовлен под будущую авторизацию, синхронизацию истории, уведомления и персонализацию AI.</p></div>
    <section className="catalog-tools widget">
      <div className="filter-grid">
        <div><span>Аккаунт</span><h3>Supabase Auth</h3><p>Будет подключён позже.</p></div>
        <div><span>AI</span><h3>Персональный вкус</h3><p>Рекомендации по истории и оценкам.</p></div>
        <div><span>Уведомления</span><h3>Новые серии</h3><p>Подготовка под Telegram/email.</p></div>
      </div>
    </section>
  </main>
}
