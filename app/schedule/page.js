export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Расписание выхода серий аниме — AIanime',
  description: 'Еженедельное расписание выхода новых серий аниме на русском: онгоинги, даты эфиров, постеры и быстрый переход к просмотру.',
  alternates: { canonical: '/schedule' },
  openGraph: { title: 'Расписание выхода серий аниме — AIanime', description: 'Еженедельное расписание выхода новых серий аниме на русском: онгоинги, даты эфиров, постеры и быстрый переход к просмотру.', url: '/schedule', type: 'website' }
}

import Link from 'next/link'
import { getWeeklySchedule } from '@/lib/scheduleData'
import { collectionPageJsonLd, jsonLd } from '@/lib/seo'

export default async function Page() {
  const weeklySchedule = await getWeeklySchedule()
  const scheduleItems = (weeklySchedule?.days || []).flatMap(day => (day.items || []).map(item => ({
    name:`${item.title || 'Аниме'} — ${item.meta || 'серия'}`,
    url:item.href || `/anime/${item.slug || ''}`
  }))).slice(0, 24)

  return (
    <main className="page schedule-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(collectionPageJsonLd({
        name:'Расписание выхода серий аниме',
        description:'Еженедельное расписание новых серий аниме на русском в AIanime.',
        path:'/schedule',
        items:scheduleItems
      }))}} />
      <div className="page-head schedule-hero">
        <Link href="/">← На главную</Link>
        <span>еженедельный календарь</span>
        <h1>Расписание выхода серий</h1>
        <p>Реальные эфиры текущей недели. Данные обновляются cron-синхронизацией и карточки ведут прямо на страницы аниме.</p>
      </div>

      <section className="schedule-board">
        {weeklySchedule.days.map((day) => (
          <article className={day.isToday ? 'schedule-day-card schedule-day-card-today' : 'schedule-day-card'} key={day.key}>
            <header>
              <div>
                <b>{day.name}</b>
                <span>{day.month} • {day.date}</span>
              </div>
              <i>{day.isToday ? 'сегодня' : day.countText}</i>
            </header>

            <div className="schedule-day-list">
              {day.items.length ? day.items.map((item) => (
                <Link className="schedule-release" href={item.href || `/anime/${item.slug}`} key={item.notifyKey || `${day.key}-${item.slug}-${item.time}`}>
                  <img loading="lazy" decoding="async" width="180" height="260" src={item.poster || '/posters/magic2.svg'} alt={item.title ? `Постер аниме ${item.title}` : 'Постер аниме'} />
                  <div>
                    <time>{item.time}</time>
                    <strong>{item.title}</strong>
                    <span>{item.meta}</span>
                  </div>
                  <em>открыть</em>
                </Link>
              )) : (
                <div className="schedule-day-empty">
                  <b>Нет релизов</b>
                  <span>Новые серии появятся после обновления расписания.</span>
                </div>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
