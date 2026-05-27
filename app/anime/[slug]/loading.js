export default function AnimeLoading(){
  return <main className="anime-compact-page route-skeleton" aria-label="Загрузка тайтла">
    <nav className="title-top-nav title-top-nav-premium skeleton-title-nav">
      <div className="sk sk-nav-logo" />
      <div className="sk sk-nav-pill" />
      <div className="sk sk-nav-pill short" />
    </nav>
    <section className="anime-compact-card compact-card-polished skeleton-anime-card">
      <div className="anime-compact-left">
        <div className="sk sk-breadcrumb" />
        <div className="sk sk-anime-title" />
        <div className="sk sk-anime-alias" />
        <div className="skeleton-chip-row">{Array.from({length:4}).map((_,i)=><div className="sk sk-chip" key={i}/>)}</div>
        <div className="skeleton-info-grid">{Array.from({length:8}).map((_,i)=><div className="sk sk-info-line" key={i}/>)}</div>
        <div className="skeleton-chip-row compact">{Array.from({length:5}).map((_,i)=><div className="sk sk-genre-chip" key={i}/>)}</div>
        <div className="sk sk-description" />
        <div className="skeleton-action-row"><div className="sk sk-action"/><div className="sk sk-action secondary"/></div>
      </div>
      <aside className="sk skeleton-big-poster" />
    </section>
    <section className="compact-player-section skeleton-player-section skeleton-player-section-v64" aria-hidden="true">
      <div className="skeleton-player-minibar">
        <div className="sk sk-title small"/>
        <div className="sk sk-link"/>
      </div>
    </section>
  </main>
}
