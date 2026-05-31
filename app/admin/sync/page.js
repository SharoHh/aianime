export const dynamic = 'force-dynamic'

import AdminDiagnosticsClient from '../diagnostics/AdminDiagnosticsClient'

export const metadata = { title:'Админпанель — AIanime', robots:{ index:false, follow:false } }

export default function AdminSyncPage(){
  return <AdminDiagnosticsClient />
}
