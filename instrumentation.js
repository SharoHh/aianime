// AIanime v92
// Фоновый прогрев runtime-кеша после старта Next/PM2. Это снижает долгую первую
// загрузку после рестарта и не меняет каталог, картинки, Supabase или API.
export async function register(){
  if(process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') return

  setTimeout(async () => {
    try{
      const repo = await import('./lib/animeRepository.js')
      await repo.getAnimeList({ limit: 1000 })
    }catch(error){
      console.warn('AIanime v92 warmup skipped:', error?.message || error)
    }
  }, 1500)
}
