export const dynamic = 'force-dynamic'

import Link from 'next/link'
import LocalAnimeList from '@/components/LocalAnimeList'
import AuthRequiredClient from '@/components/AuthRequiredClient'

export const metadata = { title: 'История просмотра — Aianime' }

export default function HistoryPage(){
  return <main className="page">
    <div className="page-head"><Link href="/">← На главную</Link><h1>История</h1><p>Последние тайтлы, которые ты открывал или добавлял в историю.</p></div>
    <AuthRequiredClient title="Войди, чтобы открыть историю" text="История просмотра сохраняется только в аккаунте, чтобы не создавать локальный мусор у гостей.">
      <LocalAnimeList storageKey="anime:history" emptyTitle="История пустая" emptyText="Открой страницу тайтла и добавь его в историю." />
    </AuthRequiredClient>
  </main>
}
