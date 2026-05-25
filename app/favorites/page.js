export const dynamic = 'force-dynamic'

import Link from 'next/link'
import LocalAnimeList from '@/components/LocalAnimeList'
import AuthRequiredClient from '@/components/AuthRequiredClient'

export const metadata = { title: 'Избранное — Aianime' }

export default function FavoritesPage(){
  return <main className="page">
    <div className="page-head"><Link href="/">← На главную</Link><h1>Избранное</h1><p>Твои сохранённые тайтлы синхронизируются с аккаунтом.</p></div>
    <AuthRequiredClient title="Войди, чтобы открыть избранное" text="Избранное сохраняется только в аккаунте, чтобы оно не пропадало после обновления или входа с другого устройства.">
      <LocalAnimeList storageKey="anime:favorites" emptyTitle="Пока ничего нет" emptyText="Добавляй тайтлы в избранное со страницы аниме." />
    </AuthRequiredClient>
  </main>
}
