export const dynamic = 'force-dynamic'

import Link from 'next/link'

export const metadata = {
  title:'Топ аниме — Aianime',
  description:'Топы аниме по рейтингу, популярности, новинкам и количеству серий.'
}

export default function TopPage(){
  const items = [
    ['По рейтингу','Самые высоко оценённые тайтлы','/top/rating','★'],
    ['Популярные','Тайтлы, которые чаще всего открывают','/top/popular','♨'],
    ['Новые','Свежие тайтлы и сезонные релизы','/top/new','✦'],
    ['Длинные','Аниме с большим количеством серий','/top/episodes','▻'],
  ]
  return <main className="page seo-page">
    <div className="page-head seo-head"><Link href="/">← На главную</Link><h1>Топ аниме</h1><p>Рейтинги и подборки для быстрого выбора.</p></div>
    <section className="seo-grid">
      {items.map(([title,text,href,icon])=><Link className="seo-card top-card" href={href} key={href}><i>{icon}</i><b>{title}</b><p>{text}</p><em>Открыть →</em></Link>)}
    </section>
  </main>
}
