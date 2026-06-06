export const dynamic = 'force-dynamic'

import Link from 'next/link'
import LocalAnimeList from '@/components/LocalAnimeList'
import AuthRequiredClient from '@/components/AuthRequiredClient'

export const metadata = {
  title: 'История просмотра — AIanime',
  description: 'Личная история просмотра аниме в профиле AIanime.',
  robots: { index:false, follow:false }
}

export default function HistoryPage(){
  return <main className="page profile-page-clean local-library-page">
    <div className="page-head profile-clean-page-head">
      <Link href="/profile">← В профиль</Link>
      <h1>История просмотра</h1>
      <p>Тайтлы, серии и озвучки, которые ты открывал в плеере. Можно быстро вернуться к просмотру.</p>
    </div>
    <AuthRequiredClient title="Войди, чтобы видеть историю" text="История просмотра привязывается к аккаунту и синхронизируется между устройствами.">
      <LocalAnimeList
        storageKey="anime:history"
        emptyTitle="История пока пустая"
        emptyText="Открой тайтл и включи серию — она появится здесь."
      />
    </AuthRequiredClient>
  </main>
}
