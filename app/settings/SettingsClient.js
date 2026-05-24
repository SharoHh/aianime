'use client'

import AuthRequiredClient from '@/components/AuthRequiredClient'

export default function SettingsClient(){
  return <AuthRequiredClient title="Войди, чтобы открыть настройки" text="Настройки аккаунта и персонализации скрыты для гостей.">
    <section className="catalog-tools widget">
      <div className="filter-grid">
        <div><span>Аккаунт</span><h3>Supabase Auth</h3><p>Вход подключён. Профиль и синхронизация доступны после авторизации.</p></div>
        <div><span>AI</span><h3>Персональный вкус</h3><p>Рекомендации по истории, избранному и оценкам.</p></div>
        <div><span>Уведомления</span><h3>Новые серии</h3><p>Подготовка под Telegram/email.</p></div>
      </div>
    </section>
  </AuthRequiredClient>
}
