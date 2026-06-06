// AIanime v93
// Лёгкая заглушка жанра вместо пустого route fallback.
export default function GenreLoading(){
  return <main className="route-loading-shell route-loading-genre" data-aianime-loading="v93">
    <section className="route-loading-panel" aria-label="Загружаем жанр">
      <div className="route-loading-topline"><i/><span/></div>
      <div className="route-loading-grid"><i/><i/><i/><i/><i/><i/></div>
    </section>
  </main>
}
