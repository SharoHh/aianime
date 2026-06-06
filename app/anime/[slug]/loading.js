// AIanime v93
// Лёгкая заглушка страницы тайтла: контент не исчезает до одного footer.
export default function AnimeLoading(){
  return <main className="route-loading-shell route-loading-title" data-aianime-loading="v93">
    <section className="route-loading-panel" aria-label="Загружаем тайтл">
      <div className="route-loading-topline"><i/><span/></div>
      <div className="route-loading-title-grid"><i/><div><b/><span/><span/></div></div>
      <div className="route-loading-wide"/>
    </section>
  </main>
}
