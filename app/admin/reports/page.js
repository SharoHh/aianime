export const dynamic = 'force-dynamic'

import Link from 'next/link'
import AdminPlayerReportsClient from './AdminPlayerReportsClient'

export const metadata = { title:'Жалобы на плеер — AIanime', robots:{ index:false, follow:false } }

export default function AdminReportsPage(){
  return <main className="admin-page">
    <section className="admin-episodes">
      <div className="page-head">
        <Link href="/admin">← В админку</Link>
        <h1>Жалобы на плеер</h1>
        <p>Здесь собираются сообщения пользователей о проблемах с сериями, озвучками и загрузкой видео.</p>
      </div>
      <AdminPlayerReportsClient/>
    </section>
  </main>
}
