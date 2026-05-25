export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getWeeklySchedule } from '@/lib/scheduleData'
import AdminScheduleClient from './AdminScheduleClient'

export const metadata = { title:'Расписание — Aianime admin' }

export default async function AdminSchedulePage(){
  const weekly = await getWeeklySchedule()
  return <main className="admin-page">
    <section className="admin-episodes">
      <div className="page-head admin-page-head-row">
        <div>
          <Link href="/admin">← Админка</Link>
          <h1>Расписание</h1>
          <p>Проверка реального расписания из Supabase и ручной запуск cron-синхронизации.</p>
        </div>
        <Link className="secondary" href="/schedule">Открыть на сайте</Link>
      </div>
      <AdminScheduleClient weekly={weekly}/>
    </section>
  </main>
}
