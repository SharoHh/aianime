export const dynamic = 'force-dynamic'

import Link from 'next/link'
import LocalAnimeList from '@/components/LocalAnimeList'
import AuthRequiredClient from '@/components/AuthRequiredClient'

export const metadata = {
  title: 'Избранное — AIanime',
  description: 'Личный список избранных аниме в профиле AIanime.',
  robots: { index:false, follow:false }
}

export default function FavoritesPage(){
  return <main className="page profile-page-clean local-library-page">
    <div className="page-head profile-clean-page-head">
      <Link href="/profile">← В профиль</Link>
      <h1>Избранное</h1>
      <p>Тайтлы, которые ты сохранил для просмотра позже.</p>
    </div>
    <AuthRequiredClient title="Войди, чтобы видеть избранное" text="Избранное сохраняется в аккаунте и не потеряется после смены устройства.">
      <LocalAnimeList
        storageKey="anime:favorites"
        emptyTitle="Избранное пустое"
        emptyText="Открой любой тайтл и нажми сердечко — он появится здесь."
      />
    </AuthRequiredClient>
  </main>
}
