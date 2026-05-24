export default function CatalogLoading(){
  return <main className="page catalog-page route-skeleton" aria-label="Загрузка каталога">
    <div className="sk sk-back" />
    <div className="sk sk-page-title" />
    <div className="sk sk-page-text" />
    <section className="sk sk-catalog-tools" />
    <section className="skeleton-catalog-layout">
      <aside className="sk sk-catalog-aside" />
      <div className="skeleton-catalog-results">
        {Array.from({length:9}).map((_,i)=><div className="sk sk-catalog-card" key={i}/>) }
      </div>
    </section>
  </main>
}
