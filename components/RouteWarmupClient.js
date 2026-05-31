'use client'

import { useEffect } from 'react'

// AIanime v92
// Кастомный prefetch/progress отключён. На старте дополнительно чистим
// хвосты старых progress/transition-слоёв из прошлых сборок, чтобы после
// рестарта PM2 не было визуального зацикливания между страницами.
export default function RouteWarmupClient(){
  useEffect(() => {
    try{
      document.documentElement.classList.remove('route-changing')
      document.body?.classList.remove('route-changing')
      document.querySelectorAll('.route-progress-bar,.route-transition-overlay,[data-route-progress],[data-route-transition]').forEach(node => node.remove())
    }catch{}
  }, [])

  return null
}
