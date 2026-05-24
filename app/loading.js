export default function Loading(){
  return <main className="app-route-loading home-route-loading" aria-label="Загрузка главной страницы">
    <aside className="skeleton-sidebar">
      <div className="sk sk-brand" />
      {Array.from({length:7}).map((_,i)=><div className="sk sk-nav" key={i}/>) }
    </aside>
    <section className="skeleton-content">
      <div className="sk sk-topbar" />
      <div className="sk sk-hero" />
      <div className="skeleton-title-row"><div className="sk sk-title"/><div className="sk sk-link"/></div>
      <div className="skeleton-poster-row">{Array.from({length:5}).map((_,i)=><div className="sk sk-poster" key={i}/>)}</div>
      <div className="skeleton-title-row"><div className="sk sk-title small"/><div className="sk sk-link"/></div>
      <div className="skeleton-card-row">{Array.from({length:4}).map((_,i)=><div className="sk sk-wide-card" key={i}/>)}</div>
    </section>
  </main>
}
