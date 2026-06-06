export const dynamic = 'force-dynamic'

import Link from 'next/link'
import HomeSectionIcon from '@/components/HomeSectionIcon'
import { collectionPageJsonLd, jsonLd } from '@/lib/seo'

export const metadata = {
  title: 'Топ аниме — лучшие и популярные тайтлы | AIanime',
  description: 'Топы аниме по рейтингу, популярности, новинкам и количеству серий: быстрый выбор лучших тайтлов в каталоге AIanime.',
  alternates: { canonical: '/top' },
  openGraph: { title: 'Топ аниме — лучшие и популярные тайтлы | AIanime', description: 'Топы аниме по рейтингу, популярности, новинкам и количеству серий: быстрый выбор лучших тайтлов в каталоге AIanime.', url: '/top', type: 'website' }
}

const items = [
  ['По рейтингу','Самые высоко оценённые тайтлы','/top/rating','★'],
  ['Популярные','Тайтлы, которые чаще всего открывают','/top/popular','popular'],
  ['Новые','Свежие тайтлы и сезонные релизы','/top/new','new'],
  ['Длинные','Аниме с большим количеством серий','/top/episodes','continue'],
]

export default function TopPage(){
  return <main className="page seo-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(collectionPageJsonLd({
      name:'Топ аниме AIanime',
      description:'Разделы с лучшими, популярными, новыми и длинными аниме на AIanime.',
      path:'/top',
      items:items.map(([title,,href]) => ({ name:title, url:href }))
    }))}} />
    <div className="page-head seo-head"><Link href="/">← На главную</Link><h1>Топ аниме</h1><p>Рейтинги и подборки для быстрого выбора.</p></div>
    <section className="seo-grid">
      {items.map(([title,text,href,icon])=><Link className="seo-card top-card" href={href} key={href}><i><HomeSectionIcon type={icon}/></i><b>{title}</b><p>{text}</p><em>Открыть →</em></Link>)}
    </section>
  </main>
}
