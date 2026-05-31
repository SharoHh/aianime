// AIanime v103
// Фоновый прогрев runtime-кеша после старта Next/PM2: один общий catalog bucket + расписание.
// Не гоняем 720 и 1000 отдельно, чтобы не тратить Supabase egress после каждого рестарта.
export async function register(){
  if(process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') return

  if(String(process.env.AIANIME_CACHE_WARMUP || '1') === '0') return

  setTimeout(async () => {
    try{
      const [repo, schedule] = await Promise.all([
        import('./lib/animeRepository.js'),
        import('./lib/scheduleData.js')
      ])
      await Promise.allSettled([
        repo.getAnimeList({ limit: 720 }),
        schedule.getWeeklySchedule()
      ])
    }catch(error){
      console.warn('AIanime v103 warmup skipped:', error?.message || error)
    }
  }, 350)
}
