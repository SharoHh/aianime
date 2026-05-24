export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAnimeList } from '@/lib/animeRepository'
import AiClient from './AiClient'

export default async function Page({ searchParams }){
  const anime = await getAnimeList({ limit: 1000 })
  const resolvedSearchParams = await searchParams
  const similarSlug = resolvedSearchParams?.similar || null
  const initialQuery = resolvedSearchParams?.q || null
  return <main className="page">
    <div className="page-head"><Link href="/">← На главную</Link><h1>AI-подбор</h1><p>Опиши настроение, похожий тайтл или ситуацию — AI подберёт варианты из каталога.</p></div>
    <div className="ai-extra-link"><Link className="secondary" href="/ai/quiz">Пройти короткий AI-опрос</Link></div>
    <AiClient items={anime} similarSlug={similarSlug} initialQuery={initialQuery}/>
  </main>
}
