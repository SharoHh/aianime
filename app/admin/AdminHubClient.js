'use client'

// AIanime v131: removed redundant public settings page entry.

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
    text:'Ручная правка тайтлов, русских названий, описаний, жанров, постеров и серий.'
  },
  {
    id:'home',
    label:'Главная',
    icon:'AI',
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
    { title:'Аниме в базе', value:'animeCount', hint:'Загружено из Supabase, не seed fallback', href:'/admin/anime' },
    { title:'Русские названия', value:'titleRuCount', hint:'title_ru уже заполнены', href:'/admin/anime?filter=missingTitle' },
    { title:'Проблемные данные', value:'badTitleCount', hint:'Мусор/латиница/поля для ручной чистки', href:'/admin/anime?filter=needsContent' },
    { title:'Расписание', value:'Cron', hint:'Реальные эфиры + автообновление', href:'/admin/sync' },
    { title:'Комментарии', value:'Модерация', hint:'Проверка пользовательских сообщений', href:'/admin/comments' },
    { title:'Жалобы на плеер', value:'Проблемы', hint:'Серии, озвучки и видео, о которых сообщили пользователи', href:'/admin/reports' },
  ],
  content: [
    { title:'Тайтлы', value:'Редактировать', hint:'title_ru, описание, жанры, постер, статус', href:'/admin/anime' },
    { title:'Без RU названия', value:'missingTitleCount', hint:'Что нужно добить вручную', href:'/admin/anime?filter=missingTitle' },
    { title:'title_ru латиницей', value:'latinTitleCount', hint:'Где нужен ручной русский вариант', href:'/admin/anime?filter=latinTitle' },
    { title:'Без описания', value:'missingDescriptionCount', hint:'Пустые или заглушечные description_ru', href:'/admin/anime?filter=missingDescription' },
    { title:'Короткие описания', value:'shortDescriptionCount', hint:'Нужно сгенерировать или дописать description_ru', href:'/admin/anime?filter=shortDescription' },
    { title:'Английские жанры', value:'englishGenresCount', hint:'Жанры, которые нужно перевести', href:'/admin/anime?filter=englishGenres' },
    { title:'Серии', value:'Управлять', hint:'Плееры и episode records', href:'/admin/episodes' },
    { title:'Каталог', value:'Проверить', hint:'Публичный каталог', href:'/catalog' },
  ],
  home: [
    { title:'Расписание', value:'Редактировать', hint:'Проверить реальные эфиры', href:'/admin/schedule' },
    { title:'Подборки', value:'Редактировать', hint:'Карточки подборок на главной', href:'/admin/collections' },
    { title:'Уведомления', value:'Открыть', hint:'Список включённых напоминаний', href:'/notifications' },
    { title:'AI-блок', value:'Проверить', hint:'Подбор по настроению и AI-опрос', href:'/ai' },
  ],
  community: [
    { title:'Комментарии', value:'Модерация', hint:'Удаление нежелательных комментариев', href:'/admin/comments' },
    { title:'Жалобы на плеер', value:'Проверить', hint:'Проблемы с сериями и озвучками', href:'/admin/reports' },
    { title:'Профиль', value:'Проверить', hint:'Аватар, фон, имя, уровень', href:'/profile' },
    { title:'Избранное', value:'Проверить', hint:'Пользовательские списки', href:'/favorites' },
    { title:'История', value:'Проверить', hint:'Продолжить просмотр и история', href:'/history' },
  ],
  system: [
    { title:'Cron-панель', value:'Запуск', hint:'Jikan, Kodik, players, schedule, title_ru', href:'/admin/sync' },
    { title:'Диагностика', value:'Проверить', hint:'Supabase / Jikan / Kodik / Player', href:'/admin/diagnostics' },
    { title:'Health-check', value:'API', hint:'Публичный /api/health без секретов', href:'/api/health' },
    { title:'Sitemap', value:'SEO', hint:'Публичный /sitemap.xml', href:'/sitemap.xml' },
    { title:'Расписание', value:'API', hint:'/api/cron/schedule', href:'/admin/sync' },
  ],
}

export default function AdminHubClient({ animeCount = 0, qualityStats = {} }){
  const [active,setActive] = useState('overview')
  const current = sections.find(x => x.id === active) || sections[0]
  const activeCards = useMemo(()=>cards[active] || [], [active])

  const stats = {
    animeCount,
    titleRuCount: qualityStats.titleRuCount || 0,
    missingTitleCount: qualityStats.missingTitleCount || 0,
    badTitleCount: qualityStats.badTitleCount || 0,
    needsContentCount: qualityStats.needsContentCount || 0,
    latinTitleCount: qualityStats.latinTitleCount || 0,
    badSymbolsCount: qualityStats.badSymbolsCount || 0,
    missingDescriptionCount: qualityStats.missingDescriptionCount || 0,
    shortDescriptionCount: qualityStats.shortDescriptionCount || 0,
    generatedDescriptionCount: qualityStats.generatedDescriptionCount || 0,
    englishGenresCount: qualityStats.englishGenresCount || 0,
    ongoingCount: qualityStats.ongoingCount || 0,
  }

  function value(card){
    return stats[card.value] ?? card.value
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
        <Link href="/admin/anime">Редактор тайтлов</Link>
        <Link href="/admin/sync">Cron-панель</Link>
        <Link href="/admin/schedule">Расписание</Link>
        <Link href="/admin/comments">Комментарии</Link>
        <Link href="/admin/reports">Жалобы на плеер</Link>
      </div>
    </aside>

    <section className="admin-hub-content">
      <header className="admin-hub-top">
        <div>
          <Link href="/">← На сайт</Link>
          <h1>{current.title}</h1>
          <p>{current.text}</p>
        </div>
        <Link className="admin-hub-open" href="/admin/anime">Редактировать тайтлы</Link>
      </header>

      <section className="admin-hub-stats">
        <div><span>Тайтлы</span><b>{animeCount}</b></div>
        <div><span>title_ru</span><b>{stats.titleRuCount}</b></div>
        <div><span>Без RU</span><b>{stats.missingTitleCount}</b></div>
        <div><span>Онгоинги</span><b>{stats.ongoingCount}</b></div>
        <div><span>Проблемы</span><b>{stats.needsContentCount || stats.badTitleCount}</b></div>
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
          <h2>Удобный порядок работы</h2>
          <p>Сначала запускаем title_ru, description_ru/жанры в cron-панели, потом вручную добиваем проблемные тайтлы в редакторе. Публичный дизайн сайта не меняется.</p>
        </div>
        <div className="admin-hub-plan-list">
          <span>title_ru</span>
          <span>description_ru</span>
          <span>жанры</span>
          <span>постеры</span>
          <span>плееры</span>
          <span>расписание</span>
          <span>cron</span>
        </div>
      </section>
    </section>
  </div>
}
