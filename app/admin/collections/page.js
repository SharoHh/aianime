export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { collections } from '@/lib/data'
import AdminCollectionsClient from './AdminCollectionsClient'

export const metadata = { title:'Админка подборок — Aianime' }

export default function AdminCollectionsPage(){
  return <main className="admin-page">
    <section className="admin-episodes">
      <div className="page-head"><Link href="/">← На главную</Link><h1>Подборки</h1><p>Управление подборками на главной.</p></div>
      <AdminCollectionsClient initial={collections}/>
    </section>
  </main>
}
