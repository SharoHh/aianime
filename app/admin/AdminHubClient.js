'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

const sections = [
  {
    id:'overview',
    label:'Обзор',
    icon:'⌂',
    title:'Обзор проекта',
    text:'Быстрый статус сайта, данные, синхронизация и основные разделы управления.'
  },
  {
    id:'content',
    label:'Контент',
    icon:'▦',
    title:'Контент сайта',
    text:'Аниме, эпизоды, постеры, баннеры и описания.'
  },
  {
    id:'home',
    label:'Главная',
    icon:'✦',
    title:'Главная страница',
    text:'Расписание, подборки, hero-блоки и блоки рекомендаций.'
  },
  {
    id:'community',
    label:'Сообщество',
    icon:'♡',
    title:'Сообщество',
    text:'Комментарии, профиль, уведомления и пользовательская активность.'
  },
  {
    id:'system',
    label:'Система',
    icon:'⚙',
    title:'Система',
    text:'Синхронизация, cron, Supabase и технические настройки.'
  },
]

const cards = {
  overview: [
    { title:'Аниме в базе', value:'animeCount', hint:'Загружено из Supabase/seed', href:'/admin/anime' },
    { title:'Расписание', value:'7 дней', hint:'Главная + страница расписания', href:'/admin/schedule' },
    { title:'Подборки', value:'Главная', hint:'Управление блоками подборок', href:'/admin/collections' },
    { title:'Комментарии', value:'Модерация', hint:'Проверка локальных комментариев', href:'/admin/comments' },
  ],
  content: [
    { title:'Аниме', value:'Редактировать', hint:'Название, описание, постер, баннер, статус', href:'/admin/anime' },
    { title:'Эпизоды', value:'Управлять', hint:'Добавление и подготовка серий', href:'/admin/episodes' },
    { title:'Каталог', value:'Проверить', hint:'Фильтры, жанры, карточки', href:'/catalog' },
    { title:'Сезонное', value:'Проверить', hint:'Онгоинги и сезонные подборки', href:'/season' },
  ],
  home: [
    { title:'Расписание', value:'Редактировать', hint:'Время, постер, серия, колокольчики', href:'/admin/schedule' },
    { title:'Подборки', value:'Редактировать', hint:'Карточки подборок на главной', href:'/admin/collections' },
    { title:'Уведомления', value:'Открыть', hint:'Список включённых напоминаний', href:'/notifications' },
    { title:'AI-блок', value:'Проверить', hint:'Подбор по настроению и AI-опрос', href:'/ai' },
  ],
  community: [
    { title:'Комментарии', value:'Модерация', hint:'Удаление нежелательных комментариев', href:'/admin/comments' },
    { title:'Профиль', value:'Проверить', hint:'Аватар, фон, имя, уровень', href:'/profile' },
    { title:'Избранное', value:'Проверить', hint:'Локальные пользовательские списки', href:'/favorites' },
    { title:'История', value:'Проверить', hint:'Продолжить просмотр и история', href:'/history' },
  ],
  system: [
    { title:'Диагностика', value:'Проверить', hint:'Supabase / Jikan / Kodik / Player', href:'/admin/diagnostics' },
    { title:'Синхронизация', value:'Запуск', hint:'Jikan/MAL + Kodik sync', href:'/admin/sync' },
    { title:'Player sync', value:'API', hint:'/api/cron/players', href:'/api/cron/players?enable=1&limit=20' },
    { title:'Настройки', value:'Открыть', hint:'Параметры сайта и профиля', href:'/settings' },
  ],
}

export default function AdminHubClient({ animeCount = 0 }){
  const [active,setActive] = useState('overview')
  const current = sections.find(x => x.id === active) || sections[0]
  const activeCards = useMemo(()=>cards[active] || [], [active])

  function value(card){
    return card.value === 'animeCount' ? animeCount : card.value
  }

  return <div className="admin-hub">
    <aside className="admin-hub-sidebar">
      <Link href="/" className="admin-hub-brand">
        <span>✿</span>
        <div><b>Aianime admin</b><em>панель управления</em></div>
      </Link>

      <nav>
        {sections.map(section=><button className={active===section.id?'active':''} onClick={()=>setActive(section.id)} key={section.id}>
          <span>{section.icon}</span>{section.label}
        </button>)}
      </nav>

      <div className="admin-hub-mini">
        <b>Быстрые ссылки</b>
        <Link href="/admin/anime">Аниме</Link>
        <Link href="/admin/schedule">Расписание</Link>
        <Link href="/admin/comments">Комментарии</Link>
        <Link href="/admin/diagnostics">Диагностика</Link>
      </div>
    </aside>

    <section className="admin-hub-content">
      <header className="admin-hub-top">
        <div>
          <Link href="/">← На сайт</Link>
          <h1>{current.title}</h1>
          <p>{current.text}</p>
        </div>
        <Link className="admin-hub-open" href="/admin/diagnostics">Диагностика</Link>
      </header>

      <section className="admin-hub-stats">
        <div><span>Тайтлы</span><b>{animeCount}</b></div>
        <div><span>Разделы</span><b>5</b></div>
        <div><span>Модерация</span><b>ON</b></div>
        <div><span>Статус</span><b>LIVE</b></div>
      </section>

      <section className="admin-hub-grid">
        {activeCards.map(card=><Link className="admin-hub-card" href={card.href} key={card.title}>
          <span>{card.title}</span>
          <b>{value(card)}</b>
          <p>{card.hint}</p>
          <em>Открыть →</em>
        </Link>)}
      </section>

      <section className="admin-hub-plan">
        <div>
          <h2>Что уже объединено</h2>
          <p>Все отдельные админ-разделы собраны в одном месте. Старые страницы остались рабочими, но теперь к ним можно попасть через единую панель.</p>
        </div>
        <div className="admin-hub-plan-list">
          <span>Аниме</span>
          <span>Эпизоды</span>
          <span>Расписание</span>
          <span>Подборки</span>
          <span>Комментарии</span>
          <span>Синхронизация</span>
          <span>Диагностика</span>
        </div>
      </section>
    </section>
  </div>
}
