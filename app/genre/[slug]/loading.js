export default function GenreLoading(){
  return <main className="page seo-page route-skeleton" aria-label="Загрузка жанра">
    <div className="sk sk-back" />
    <div className="sk sk-page-title" />
    <div className="sk sk-page-text" />
    <div className="skeleton-poster-row genre-loading-row">{Array.from({length:10}).map((_,i)=><div className="sk sk-poster" key={i}/>)}</div>
  </main>
}
