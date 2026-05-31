export const dynamic = 'force-dynamic'

import { getAnimeList } from '@/lib/animeRepository'
import AdminHubClient from './AdminHubClient'

export const metadata = {
  title: 'Админпанель — AIanime',
  description: 'Внутренняя админпанель AIanime.',
  robots: { index:false, follow:false }
}

function hasLatinOnly(value){
  const text = String(value || '').trim()
  return Boolean(text && /[A-Za-z]/.test(text) && !/[А-Яа-яЁё]/.test(text))
}

function hasEnglishGenre(genres){
  const list = Array.isArray(genres) ? genres : String(genres || '').split(',')
  return list.some(genre => {
    const text = String(genre || '').trim()
    return Boolean(text && /^[A-Za-z0-9\s()'&:/.+-]+$/.test(text))
  })
}

function isBadDescription(value){
  const text = String(value || '').trim()
  if(!text) return true
  if(text.toLowerCase().includes('будет добавлено')) return true
  if(text.length < 140) return true
  return false
}

function isGeneratedDescription(value){
  const text = String(value || '')
  return text.includes('подойдёт зрителям') || text.includes('атмосферу истории, развитие персонажей')
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
    shortDescriptionCount: anime.filter(item => isBadDescription(item.descriptionRu || item.description)).length,
    generatedDescriptionCount: anime.filter(item => isGeneratedDescription(item.descriptionRu || item.description)).length,
    englishGenresCount: anime.filter(item => hasEnglishGenre(item.genres)).length,
    needsContentCount: anime.filter(item => isBadDescription(item.descriptionRu || item.description) || hasEnglishGenre(item.genres) || /[●•]{2,}/.test(`${item.titleRu || ''} ${item.title || ''} ${item.descriptionRu || ''}`)).length,
    ongoingCount: anime.filter(item => item.status === 'ongoing').length,
  }
  return <main className="admin-hub-page">
    <AdminHubClient animeCount={anime.length} qualityStats={qualityStats}/>
  </main>
}
