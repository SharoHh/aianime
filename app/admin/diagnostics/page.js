export const dynamic = 'force-dynamic'

import AdminDiagnosticsClient from './AdminDiagnosticsClient'

export const metadata = {
  title: 'Cron и диагностика — Aianime admin',
  description: 'Jikan, Kodik, Supabase, расписание и русификация.'
}

export default function AdminDiagnosticsPage(){
  return <AdminDiagnosticsClient />
}
