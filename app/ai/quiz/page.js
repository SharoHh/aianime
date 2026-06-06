export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAnimeList } from '@/lib/animeRepository'
import AiQuizClient from './AiQuizClient'

export const metadata = { title:'AI-вопросы — Aianime' }

export default async function AiQuizPage(){
  const anime = await getAnimeList({limit:1000})
  return <main className="page">
    <div className="page-head"><Link href="/ai">← Назад к AI</Link><h1>AI-подбор по вопросам</h1><p>Ответь на несколько коротких вопросов — сайт подберёт тайтлы точнее.</p></div>
    <AiQuizClient items={anime}/>
  </main>
}
