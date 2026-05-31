'use client'

// AIanime v137: shared compact light menu with clean SVG icons.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import TitleAuthActionClient from '@/components/TitleAuthActionClient'
import HomeSectionIcon from '@/components/HomeSectionIcon'

const HIDDEN_PREFIXES = ['/admin', '/auth', '/anime']

function shouldHide(pathname){
  const path = pathname || '/'
  if(path === '/') return true
  return HIDDEN_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}

export default function SiteInteriorHeaderClient(){
  const pathname = usePathname()
  if(shouldHide(pathname)) return null

  return <header className="site-interior-header" data-aianime-interior-menu="v120" aria-label="Меню сайта">
    <div className="site-interior-header__bar">
      <Link href="/" className="site-interior-header__brand" aria-label="AIanime — на главную">
        <img src="/aianime-logo.png" alt="" aria-hidden="true" />
        <b>Aianime</b>
      </Link>

      <nav className="site-interior-header__nav" aria-label="Разделы сайта">
        <Link href="/catalog"><HomeSectionIcon type="collections"/>Каталог</Link>
        <Link href="/season"><HomeSectionIcon type="continue"/>Онгоинги</Link>
        <Link href="/schedule"><HomeSectionIcon type="schedule"/>Расписание</Link>
        <Link href="/collections"><HomeSectionIcon type="new"/>Подборки</Link>
        <Link href="/ai"><HomeSectionIcon type="ai"/>Что посмотреть?</Link>
        <Link href="/recommend"><HomeSectionIcon type="top"/>Случайное</Link>
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
