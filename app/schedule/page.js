export const revalidate = 120

import Link from 'next/link'
import { schedule } from '@/lib/data'

const week = [
  ['Понедельник', '13', [0, 3]],
  ['Вторник', '14', [0, 1, 2]],
  ['Среда', '15', [1, 4]],
  ['Четверг', '16', [2, 0]],
  ['Пятница', '17', [2, 3, 4]],
  ['Суббота', '18', [1, 3]],
  ['Воскресенье', '19', []],
]

function slugify(value, index) {
  return value?.toLowerCase?.().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '') || `schedule-${index}`
}

export default function Page() {
  return (
    <main className="page schedule-page">
      <div className="page-head schedule-hero">
        <Link href="/">← На главную</Link>
        <span>еженедельный календарь</span>
        <h1>Расписание выхода серий</h1>
        <p>Удобная сетка по дням недели. Когда появятся реальные данные из sync, здесь будут показываться актуальные релизы.</p>
      </div>

      <section className="schedule-board">
        {week.map(([day, date, indexes]) => {
          const items = indexes.map((sourceIndex) => schedule[sourceIndex]).filter(Boolean)

          return (
            <article className="schedule-day-card" key={day}>
              <header>
                <div>
                  <b>{day}</b>
                  <span>май • {date}</span>
                </div>
                <i>{items.length ? `${items.length} релиза` : 'пусто'}</i>
              </header>

              <div className="schedule-day-list">
                {items.length ? items.map((item, index) => (
                  <Link className="schedule-release" href={`/anime/${slugify(item[1], index)}`} key={`${day}-${item[0]}-${item[1]}`}>
                    <img src={item[3]} alt="Аниме" />
                    <div>
                      <time>{item[0]}</time>
                      <strong>{item[1]}</strong>
                      <span>{item[2]}</span>
                    </div>
                    <em>смотреть</em>
                  </Link>
                )) : (
                  <div className="schedule-day-empty">
                    <b>Нет релизов</b>
                    <span>Новые серии появятся после обновления расписания.</span>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}
