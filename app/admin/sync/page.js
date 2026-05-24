export const dynamic = 'force-dynamic'

import AdminDiagnosticsClient from '../diagnostics/AdminDiagnosticsClient'

export const metadata = {
  title: 'Синхронизация — Aianime admin',
  description: 'Jikan, Kodik, Supabase и player sync.'
}

export default function AdminSyncPage(){
  return <AdminDiagnosticsClient />
}
