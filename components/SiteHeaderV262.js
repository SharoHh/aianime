'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import HomeSectionIcon from '@/components/HomeSectionIcon'
import GlobalSearchOverlay from '@/components/GlobalSearchOverlay'
import HeaderDiscoveryMenu from '@/components/HeaderDiscoveryMenu'
import TitleAuthActionClient from '@/components/TitleAuthActionClient'

const PRIMARY_LINKS = [
  { href:'/catalog', label:'Каталог', icon:'catalog' },
  { href:'/season', label:'Онгоинги', icon:'ongoing' },
  { href:'/schedule', label:'Расписание', icon:'schedule' }
]

const QUICK_LINKS = [
  { href:'/catalog', label:'Все аниме', icon:'catalog', match:{ pathname:'/catalog' } },
  { href:'/catalog?sort=newest', label:'Новинки', icon:'new', match:{ sort:'newest' } },
  { href:'/catalog?sort=popular', label:'Популярное', icon:'popular', match:{ sort:'popular' } },
  { href:'/catalog?kind=movie', label:'Фильмы', icon:'movie', match:{ kind:'movie' } },
  { href:'/catalog?kind=tv', label:'Сериалы', icon:'series', match:{ kind:'tv' } },
  { href:'/collections', label:'Подборки сообщества', icon:'collections', match:{ pathname:'/collections' } }
]

function pathMatches(pathname, href){
  return pathname === href || pathname?.startsWith(`${href}/`)
}

function queryValue(search, name){
  return new URLSearchParams(String(search || '').replace(/^\?/, '')).get(name)
}

function quickLinkActive(pathname, search, link){
  if(link.match?.pathname && !pathMatches(pathname, link.match.pathname)) return false
  if(link.match?.sort) return queryValue(search, 'sort') === link.match.sort
  if(link.match?.kind) return queryValue(search, 'kind') === link.match.kind
  if(link.href === '/catalog') return pathname === '/catalog' && !queryValue(search, 'sort') && !queryValue(search, 'kind')
  return Boolean(link.match?.pathname)
}

function searchFromHref(href){
  const value = String(href || '')
  const index = value.indexOf('?')
  return index >= 0 ? value.slice(index) : ''
}

export default function SiteHeaderV262({ searchItems = [] }){
  const pathname = usePathname()
  const [currentSearch, setCurrentSearch] = useState('')

  useEffect(() => {
    const syncSearch = () => setCurrentSearch(window.location.search || '')
    syncSearch()
    window.addEventListener('popstate', syncSearch)
    return () => window.removeEventListener('popstate', syncSearch)
  }, [pathname])

  return <header className="aianime-header-v262" data-aianime-header="v266" aria-label="Меню AIanime">
    <div className="aianime-header-v262__main">
      <Link href="/" className="aianime-header-v262__brand" aria-label="AIanime — на главную">
        <span className="aianime-header-v262__logo"><img src="/aianime-logo.png" alt="" aria-hidden="true" /></span>
        <b>Aianime</b>
      </Link>

      <nav className="aianime-header-v262__primary" aria-label="Основные разделы">
        {PRIMARY_LINKS.map(item => {
          const active = pathMatches(pathname, item.href)
          return <Link
            key={item.href}
            href={item.href}
            className={active ? 'is-active' : undefined}
            aria-current={active ? 'page' : undefined}
          >
            <HomeSectionIcon type={item.icon}/>
            <span>{item.label}</span>
          </Link>
        })}
        <HeaderDiscoveryMenu/>
      </nav>

      <div className="aianime-header-v262__actions">
        <GlobalSearchOverlay items={searchItems} className="aianime-header-v262__search" label="Поиск аниме..."/>
        <TitleAuthActionClient/>
      </div>
    </div>

    <div className="aianime-header-v262__quick-wrap">
      <nav className="aianime-header-v262__quick" aria-label="Быстрые разделы каталога">
        {QUICK_LINKS.map(item => {
          const active = quickLinkActive(pathname, currentSearch, item)
          return <Link
            key={item.href}
            href={item.href}
            onClick={() => setCurrentSearch(searchFromHref(item.href))}
            className={active ? 'is-active' : undefined}
            aria-current={active ? 'page' : undefined}
          >
            <HomeSectionIcon type={item.icon}/>
            <span>{item.label}</span>
          </Link>
        })}
      </nav>
    </div>
  </header>
}
