// AIanime v95
// Фоновый прогрев runtime-кеша после старта Next/PM2: каталог + расписание.
// Не меняет данные, не трогает картинки и не блокирует запуск сайта.
export async function register(){
  if(process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') return

  setTimeout(async () => {
    try{
      const [repo, schedule] = await Promise.all([
        import('./lib/animeRepository.js'),
        import('./lib/scheduleData.js')
      ])
      await Promise.allSettled([
        repo.getAnimeList({ limit: 720 }),
        repo.getAnimeList({ limit: 1000 }),
        schedule.getWeeklySchedule()
      ])
    }catch(error){
      console.warn('AIanime v95 warmup skipped:', error?.message || error)
    }
  }, 350)
}
