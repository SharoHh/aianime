'use client'

// AIanime v90
// Безопасный фикс зацикливания переходов: убираем кастомный слой прогрева ссылок,
// глобальные обработчики pointer/focus/touch/click и искусственный progress bar.
// Навигация теперь работает штатно через Next.js Link без дополнительных router.prefetch.
export default function RouteWarmupClient(){
  return null
}
