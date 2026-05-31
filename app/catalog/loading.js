// AIanime v93
// Лёгкая заглушка вместо пустого экрана с footer при переходе в каталог.
export default function CatalogLoading(){
  return <main className="route-loading-shell route-loading-catalog" data-aianime-loading="v93">
    <section className="route-loading-panel" aria-label="Загружаем каталог">
      <div className="route-loading-topline"><i/><span/></div>
      <div className="route-loading-grid"><i/><i/><i/><i/><i/><i/></div>
    </section>
  </main>
}
