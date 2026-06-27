'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href:'/', label:'Главная', icon:'home' },
  { href:'/catalog', label:'Каталог', icon:'catalog' },
  { href:'/schedule', label:'Расписание', icon:'calendar' },
  { href:'/ai', label:'AI-подбор', icon:'spark' },
  { href:'/profile', label:'Профиль', icon:'profile' },
]

function Icon({ type }){
  const common = {
    viewBox:'0 0 24 24',
    fill:'none',
    stroke:'currentColor',
    strokeWidth:'2',
    strokeLinecap:'round',
    strokeLinejoin:'round',
    'aria-hidden':'true',
  }

  if(type === 'home') return <svg {...common}><path d="M3.5 10.8 12 4l8.5 6.8"/><path d="M5.7 9.8V20h12.6V9.8"/><path d="M9.5 20v-6.2h5V20"/></svg>
  if(type === 'catalog') return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>
  if(type === 'calendar') return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M8 14h3M13.5 14H16M8 17h3"/></svg>
  if(type === 'spark') return <svg {...common}><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m18.5 15 .7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z"/></svg>
  return <svg {...common}><circle cx="12" cy="8" r="3.8"/><path d="M5 20c1.2-4.1 12.8-4.1 14 0"/></svg>
}

function isActive(pathname, href){
  if(href === '/') return pathname === '/'
  return pathname === href || pathname?.startsWith(`${href}/`)
}

export default function MobileBottomNavClient(){
  const pathname = usePathname() || '/'
  const hidden = pathname === '/auth' || pathname.startsWith('/auth/') || pathname === '/admin' || pathname.startsWith('/admin/')
  if(hidden) return null

  return <nav className="mobile-site-dock" aria-label="Мобильная навигация">
    {items.map(item => <Link
      key={item.href}
      href={item.href}
      className={isActive(pathname,item.href) ? 'is-active' : ''}
      aria-current={isActive(pathname,item.href) ? 'page' : undefined}
    >
      <span className="mobile-site-dock__icon"><Icon type={item.icon}/></span>
      <span className="mobile-site-dock__label">{item.label}</span>
    </Link>)}
  </nav>
}
