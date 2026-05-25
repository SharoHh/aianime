export const dynamic = 'force-dynamic'

import Link from 'next/link'
import LocalAnimeList from '@/components/LocalAnimeList'

export const metadata = { title: 'Избранное — Aianime' }

export default function FavoritesPage(){
  return <main className="page">
    <div className="page-head"><Link href="/">← На главную</Link><h1>Избранное</h1><p>Твои сохранённые тайтлы. Для авторизованных пользователей избранное синхронизируется с аккаунтом.</p></div>
    <LocalAnimeList storageKey="anime:favorites" emptyTitle="Пока ничего нет" emptyText="Добавляй тайтлы в избранное со страницы аниме." />
  </main>
}
