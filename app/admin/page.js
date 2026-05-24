export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAnimeList } from '@/lib/animeRepository'
import AdminHubClient from './AdminHubClient'

export const metadata = {
  title: 'Админпанель — Aianime',
  description: 'Единая админпанель управления сайтом.'
}

export default async function AdminPage(){
  const anime = await getAnimeList({limit:1000})
  return <main className="admin-hub-page">
    <AdminHubClient animeCount={anime.length}/>
  </main>
}
