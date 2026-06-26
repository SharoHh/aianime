export const dynamic = 'force-dynamic'
export const revalidate = 0

import AdminAnimeClient from './AdminAnimeClient'

export const metadata = { title:'Тайтлы v247 — AIanime admin', robots:{ index:false, follow:false } }

export default function AdminAnimePage(){
  return <main className="admin-v244-page"><AdminAnimeClient /></main>
}
