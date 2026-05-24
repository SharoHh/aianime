export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAnimeList } from '@/lib/animeRepository'
import AdminAnimeClient from './AdminAnimeClient'

export const metadata = { title: 'Админка аниме — Aianime' }

export default async function AdminAnimePage(){
  const anime = await getAnimeList({limit:1000})
  return <main className="admin-page">
    <section className="admin-episodes">
      <div className="page-head"><Link href="/">← На главную</Link><h1>Админка аниме</h1><p>Быстрое управление тайтлами: поиск, просмотр, подготовка к редактированию постеров, описаний и статусов.</p></div>
      <AdminAnimeClient items={anime}/>
    </section>
  </main>
}
