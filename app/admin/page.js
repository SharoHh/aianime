export const dynamic = 'force-dynamic'

import { getAnimeList } from '@/lib/animeRepository'
import AdminHubClient from './AdminHubClient'

export const metadata = {
  title: 'Админпанель — Aianime',
  description: 'Единая админпанель управления сайтом.'
}

function hasLatinOnly(value){
  const text = String(value || '').trim()
  return Boolean(text && /[A-Za-z]/.test(text) && !/[А-Яа-яЁё]/.test(text))
}

export default async function AdminPage(){
  const anime = await getAnimeList({limit:1000})
  const qualityStats = {
    titleRuCount: anime.filter(item => String(item.titleRu || '').trim()).length,
    missingTitleCount: anime.filter(item => !String(item.titleRu || '').trim()).length,
    badTitleCount: anime.filter(item => /[●•]{2,}/.test(`${item.titleRu || ''} ${item.title || ''}`) || hasLatinOnly(item.titleRu)).length,
    latinTitleCount: anime.filter(item => hasLatinOnly(item.titleRu)).length,
    badSymbolsCount: anime.filter(item => /[●•]{2,}/.test(`${item.titleRu || ''} ${item.title || ''} ${item.descriptionRu || ''}`)).length,
    missingDescriptionCount: anime.filter(item => !String(item.descriptionRu || item.description || '').trim() || String(item.descriptionRu || item.description || '').toLowerCase().includes('будет добавлено')).length,
    ongoingCount: anime.filter(item => item.status === 'ongoing').length,
  }
  return <main className="admin-hub-page">
    <AdminHubClient animeCount={anime.length} qualityStats={qualityStats}/>
  </main>
}
