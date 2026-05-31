'use client'

// AIanime v91
// Кастомный prefetch/progress отключён полностью: Next.js сам обрабатывает переходы.
// Это убирает зацикливание при навигации и не трогает каталог, картинки, Supabase или плеер.
export default function RouteWarmupClient(){
  return null
}
