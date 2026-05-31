'use client'

// AIanime v119: shared light menu for internal pages, hidden on home and title pages.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import TitleAuthActionClient from '@/components/TitleAuthActionClient'

const HIDDEN_PREFIXES = ['/admin', '/auth', '/anime']

function shouldHide(pathname){
  const path = pathname || '/'
  if(path === '/') return true
  return HIDDEN_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}

export default function SiteInteriorHeaderClient(){
  const pathname = usePathname()
  if(shouldHide(pathname)) return null

  return <header className="site-interior-header" data-aianime-interior-menu="v119" aria-label="Меню сайта">
    <div className="site-interior-header__bar">
      <Link href="/" className="site-interior-header__brand" aria-label="AIanime — на главную">
        <img src="/aianime-logo.png" alt="" aria-hidden="true" />
        <b>Aianime</b>
      </Link>

      <nav className="site-interior-header__nav" aria-label="Разделы сайта">
        <Link href="/catalog"><span>▦</span>Каталог</Link>
        <Link href="/season"><span>▷</span>Онгоинги</Link>
        <Link href="/schedule"><span>◷</span>Расписание</Link>
        <Link href="/collections"><span>☆</span>Подборки</Link>
        <Link href="/ai"><span>?</span>Что посмотреть?</Link>
        <Link href="/recommend"><span>↝</span>Случайное</Link>
      </nav>

      <div className="site-interior-header__actions">
        <Link href="/catalog" className="site-interior-header__search" aria-label="Открыть поиск в каталоге">
          <span>⌕</span><strong>Поиск аниме...</strong><kbd>Ctrl K</kbd>
        </Link>
        <TitleAuthActionClient/>
      </div>
    </div>
  </header>
}
