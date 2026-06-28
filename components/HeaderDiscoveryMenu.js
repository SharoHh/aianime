'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import HomeSectionIcon from '@/components/HomeSectionIcon'

const DISCOVERY_PATHS = ['/collections', '/ai', '/recommend']

const ITEMS = [
  {
    href:'/collections',
    icon:'collections',
    title:'Готовые подборки',
    description:'Сценарии просмотра без повторов'
  },
  {
    href:'/ai',
    icon:'ai',
    title:'AI-подбор',
    description:'Подобрать аниме по настроению'
  },
  {
    href:'/recommend',
    icon:'random',
    title:'Случайный тайтл',
    description:'Когда не хочется выбирать'
  }
]

function pathMatches(pathname, href){
  return pathname === href || pathname?.startsWith(`${href}/`)
}

export default function HeaderDiscoveryMenu(){
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const active = DISCOVERY_PATHS.some(path => pathMatches(pathname, path))

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    function onPointerDown(event){
      if(!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event){
      if(event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return <div ref={rootRef} className={`header-discovery${open ? ' is-open' : ''}${active ? ' is-active' : ''}`}>
    <button
      type="button"
      className="header-discovery__trigger"
      aria-expanded={open}
      aria-haspopup="menu"
      onClick={() => setOpen(value => !value)}
    >
      <HomeSectionIcon type="ai"/>
      <span>Подобрать</span>
      <svg className="header-discovery__chevron" width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="m5.5 7.5 4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>

    <div className="header-discovery__panel" role="menu" aria-label="Помощь с выбором аниме">
      <div className="header-discovery__intro">
        <b>Что посмотреть</b>
        <span>Три способа быстро найти тайтл</span>
      </div>

      {ITEMS.map(item => {
        const itemActive = pathMatches(pathname, item.href)
        return <Link
          key={item.href}
          href={item.href}
          role="menuitem"
          className={itemActive ? 'is-active' : undefined}
          aria-current={itemActive ? 'page' : undefined}
        >
          <HomeSectionIcon type={item.icon}/>
          <span>
            <b>{item.title}</b>
            <small>{item.description}</small>
          </span>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m7.5 4.5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      })}
    </div>
  </div>
}
