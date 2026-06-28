'use client'

import { usePathname } from 'next/navigation'
import SiteHeaderV262 from '@/components/SiteHeaderV262'

const HIDDEN_PREFIXES = ['/admin', '/auth', '/anime']

function shouldHide(pathname){
  const path = pathname || '/'
  if(path === '/') return true
  return HIDDEN_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}

export default function SiteInteriorHeaderClient(){
  const pathname = usePathname()
  if(shouldHide(pathname)) return null
  return <SiteHeaderV262/>
}
