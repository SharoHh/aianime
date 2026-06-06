export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAnimeList } from '@/lib/animeRepository'
import AdminAnimeClient from './AdminAnimeClient'

export const metadata = { title:'Админпанель — AIanime', robots:{ index:false, follow:false } }

export default async function AdminAnimePage(){
  const anime = await getAnimeList({limit:1000})
  return <main className="admin-page">
    <section className="admin-episodes">
      <div className="page-head admin-page-head-row">
        <div>
          <Link href="/admin">← Админка</Link>
          <h1>Редактор тайтлов</h1>
          <p>Ручная правка title_ru, description_ru, жанров, постеров и статуса. Публичную структуру сайта не меняет.</p>
        </div>
        <Link className="secondary" href="/admin/sync">Cron-панель</Link>
      </div>
      <AdminAnimeClient items={anime}/>
    </section>
  </main>
}
