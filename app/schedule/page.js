export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Расписание выхода серий — Aianime',
  description: 'Реальное расписание выхода новых серий аниме на текущую неделю с обновлением через cron.',
  openGraph: { title: 'Расписание выхода серий — Aianime', description: 'Новые серии и эфиры текущей недели.' }
}

import Link from 'next/link'
import { getWeeklySchedule } from '@/lib/scheduleData'

export default async function Page() {
  const weeklySchedule = await getWeeklySchedule()

  return (
    <main className="page schedule-page">
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
                  <img loading="lazy" decoding="async" src={item.poster || '/posters/magic2.svg'} alt={item.title || 'Аниме'} />
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
