export const dynamic = 'force-dynamic'

import Link from 'next/link'
import EpisodesAdminClient from './EpisodesAdminClient'

export const metadata = { title: 'Админка серий' }

export default function AdminEpisodesPage(){
  return <main className="page admin-page">
    <div className="page-head"><Link href="/admin/sync">← Админка</Link><h1>Управление сериями</h1><p>Подготовка к будущему автоматическому добавлению серий и плееров.</p></div>
    <EpisodesAdminClient />
  </main>
}
