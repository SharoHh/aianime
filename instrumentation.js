// AIanime v273
// Runtime-прогрев отключён: после рестарта он одновременно с первым запросом
// нагружал Supabase и во время next build удерживал workers. Репозиторий сам
// заполняет память и постоянный snapshot при первом успешном чтении каталога.
export async function register(){
  return
}
