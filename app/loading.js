// AIanime v93
// Не возвращаем null: иначе при переходе пользователь видит один footer.
// Показываем лёгкую заглушку контента, которая держит высоту страницы.
export default function Loading(){
  return <main className="route-loading-shell route-loading-home" data-aianime-loading="v93">
    <section className="route-loading-panel" aria-label="Загружаем страницу">
      <div className="route-loading-topline"><i/><span/></div>
      <div className="route-loading-hero"/>
      <div className="route-loading-row"><i/><i/><i/><i/></div>
    </section>
  </main>
}
