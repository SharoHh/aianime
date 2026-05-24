export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getWeeklySchedule } from '@/lib/scheduleData'
import NotificationsClient from './NotificationsClient'

export const metadata = {
  title: 'Уведомления — Aianime',
  description: 'Список включённых уведомлений о выходе новых серий.'
}

export default async function NotificationsPage(){
  const weeklySchedule = await getWeeklySchedule()

  return <main className="page notifications-page">
    <div className="page-head"><Link href="/">← На главную</Link><h1>Уведомления</h1><p>Тайтлы, по которым ты включил напоминания о новых сериях.</p></div>
    <NotificationsClient scheduleDays={weeklySchedule.days}/>
  </main>
}
