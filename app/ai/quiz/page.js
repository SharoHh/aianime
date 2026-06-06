export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAnimeList } from '@/lib/animeRepository'
import AiQuizClient from './AiQuizClient'
import { compactAnimeItems } from '@/lib/clientAnimePayload'

export const metadata = {
  title:'AI-вопросы — AIanime',
  description:'Короткий AI-опрос AIanime помогает подобрать аниме по настроению, жанрам, длине и вайбу.',
  alternates:{ canonical:'/ai/quiz' },
  openGraph:{ title:'AI-вопросы — AIanime', description:'Короткий AI-опрос для подбора аниме.', url:'/ai/quiz', type:'website' }
}

export default async function AiQuizPage(){
  const anime = compactAnimeItems(await getAnimeList({limit:1000}), 1000, { descriptionLimit: 260, genresLimit: 10 })
  return <main className="page">
    <div className="page-head"><Link href="/ai">← Назад к AI</Link><h1>AI-подбор по вопросам</h1><p>Ответь на несколько коротких вопросов — сайт подберёт тайтлы точнее.</p></div>
    <AiQuizClient items={anime}/>
  </main>
}
