export const dynamic = 'force-dynamic'

import Link from 'next/link'
import AuthRequiredClient from '@/components/AuthRequiredClient'
import LibraryPageClient from '@/components/LibraryPageClient'

export const metadata = {
  title:'Моя библиотека — AIanime',
  description:'Личная библиотека AIanime: смотрю, буду смотреть, просмотрено и брошено.',
  robots:{ index:false, follow:false }
}

export default function LibraryPage(){
  return <main className="page profile-page-clean local-library-page library-page">
    <div className="page-head profile-clean-page-head">
      <Link href="/profile">← В профиль</Link>
      <h1>Моя библиотека</h1>
      <p>Личные статусы тайтлов: что смотришь, что отложил, что досмотрел и что бросил.</p>
    </div>
    <AuthRequiredClient title="Войди, чтобы открыть библиотеку" text="Библиотека сохраняет личные статусы тайтлов и синхронизируется между устройствами.">
      <LibraryPageClient/>
    </AuthRequiredClient>
  </main>
}
