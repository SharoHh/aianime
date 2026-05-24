export const revalidate = 120

import Link from 'next/link'
import { collections, anime } from '@/lib/data'

const collectionRules = [
  { q:'эмоциональное тёплое аниме', filter:a => (a.genres || []).some(g => ['Драма','Романтика','Повседневность'].includes(g)) },
  { q:'приключения и экшен', filter:a => (a.genres || []).some(g => ['Приключения','Экшен','Фэнтези'].includes(g)) },
  { q:'лёгкое аниме на вечер', filter:a => (a.genres || []).some(g => ['Комедия','Повседневность','Романтика'].includes(g)) || Number(a.episodes || 0) <= 13 },
  { q:'популярные новинки', filter:a => Number(a.year || 0) >= 2024 },
  { q:'лучшие аниме по рейтингу', filter:a => Number(a.rating || a.score || 0) >= 8.6 },
]

function Poster({item}){
  return <Link href={`/anime/${item.slug}`} className="poster">
    <img loading="lazy" decoding="async" src={item.poster}/><div className="rating">★ {item.rating}</div><div className="poster-info"><b>{item.title}</b><span>{item.meta}</span></div>
  </Link>
}

export default function CollectionsPage(){
  return <main className="page">
    <div className="page-head"><Link href="/">← На главную</Link><h1>Подборки</h1><p>Живые подборки связаны с каталогом и AI-запросами. Открой подборку или сразу запусти AI-подбор.</p></div>
    {collections.map((c, i) => {
      const rule = collectionRules[i] || collectionRules[0]
      const items = anime.filter(rule.filter).slice(0,5)
      return <section key={c[0]}>
        <div className="section-title"><h2><span>{c[2]}</span>{c[0]}</h2><Link href={`/ai?q=${encodeURIComponent(rule.q)}`}>AI-подбор ›</Link></div>
        <div className="poster-row">{items.map(a => <Poster item={a} key={a.slug}/>)}</div>
      </section>
    })}
  </main>
}
