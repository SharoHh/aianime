export const dynamic = 'force-dynamic'

import AdminDiagnosticsClient from './AdminDiagnosticsClient'

export const metadata = { title:'Админпанель — AIanime', robots:{ index:false, follow:false } }

export default function AdminDiagnosticsPage(){
  return <AdminDiagnosticsClient />
}
