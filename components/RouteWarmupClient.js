'use client'

// AIanime v87:
// Полностью отключаем кастомный prefetch/progress-слой.
// В v85/v86 он уже был облегчён, но при переходах всё равно мог давать ощущение
// зацикливания: глобальные mouse/focus/touch/click listeners + router.prefetch
// могли запускать лишние RSC-запросы поверх штатной навигации Next.js.
// Теперь оставляем только нативное поведение <Link> / Next.js без дополнительных
// обработчиков, таймеров, progress bar и Mutation/Intersection/pointer loops.
export default function RouteWarmupClient(){
  return null
}
