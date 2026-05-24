export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { schedule } from '@/lib/data'
import AdminScheduleClient from './AdminScheduleClient'

export const metadata = { title:'Админка расписания — Aianime' }

export default function AdminSchedulePage(){
  return <main className="admin-page">
    <section className="admin-episodes">
      <div className="page-head"><Link href="/">← На главную</Link><h1>Расписание</h1><p>Редактирование расписания для главной и отдельной страницы.</p></div>
      <AdminScheduleClient initial={schedule}/>
    </section>
  </main>
}
