export const dynamic = 'force-dynamic'

import AdminDiagnosticsClient from './AdminDiagnosticsClient'

export const metadata = {
  title: 'Диагностика — Aianime admin',
  description: 'Диагностика Supabase, Jikan, Kodik, cron и плееров.'
}

export default function AdminDiagnosticsPage(){
  return <AdminDiagnosticsClient />
}
