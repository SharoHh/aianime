export const dynamic = 'force-dynamic'

import Link from 'next/link'
import AdminCommentsClient from './AdminCommentsClient'

export const metadata = { title:'Модерация комментариев — Aianime' }

export default function AdminCommentsPage(){
  return <main className="admin-page">
    <section className="admin-episodes">
      <div className="page-head"><Link href="/">← На главную</Link><h1>Комментарии</h1><p>Модерация локальных комментариев.</p></div>
      <AdminCommentsClient/>
    </section>
  </main>
}
