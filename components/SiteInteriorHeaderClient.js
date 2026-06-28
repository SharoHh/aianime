'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import TitleAuthActionClient from '@/components/TitleAuthActionClient'
import HomeSectionIcon from '@/components/HomeSectionIcon'
import GlobalSearchOverlay from '@/components/GlobalSearchOverlay'
import HeaderDiscoveryMenu from '@/components/HeaderDiscoveryMenu'

const HIDDEN_PREFIXES = ['/admin', '/auth', '/anime']

const PRIMARY_LINKS = [
  { href:'/catalog', label:'Каталог', icon:'catalog' },
  { href:'/season', label:'Онгоинги', icon:'ongoing' },
  { href:'/schedule', label:'Расписание', icon:'schedule' }
]

function shouldHide(pathname){
  const path = pathname || '/'
  if(path === '/') return true
  return HIDDEN_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}

function pathMatches(pathname, href){
  return pathname === href || pathname?.startsWith(`${href}/`)
}

export default function SiteInteriorHeaderClient(){
  const pathname = usePathname()
  if(shouldHide(pathname)) return null

  return <header className="site-interior-header" data-aianime-interior-menu="v261" aria-label="Меню сайта">
    <div className="site-interior-header__bar">
      <Link href="/" className="site-interior-header__brand" aria-label="AIanime — на главную">
        <img src="/aianime-logo.png" alt="" aria-hidden="true" />
        <b>Aianime</b>
      </Link>

      <nav className="site-interior-header__nav" aria-label="Основные разделы">
        {PRIMARY_LINKS.map(item => {
          const active = pathMatches(pathname, item.href)
          return <Link
            key={item.href}
            href={item.href}
            className={active ? 'is-active' : undefined}
            aria-current={active ? 'page' : undefined}
          >
            <HomeSectionIcon type={item.icon}/>
            {item.label}
          </Link>
        })}
        <HeaderDiscoveryMenu/>
      </nav>

      <div className="site-interior-header__actions">
        <GlobalSearchOverlay className="site-interior-header__search" label="Поиск аниме..."/>
        <TitleAuthActionClient/>
      </div>
    </div>
  </header>
}
