export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAnimeList, getAnimeBySlugFromRepo, getEpisodesBySlug } from '@/lib/animeRepository'
import { recommendAnime } from '@/lib/aiAnime'
import TitleActions from '@/components/TitleActions'
import CommentsClient from '@/components/CommentsClient'
import KodikPlayerClient from '@/components/KodikPlayerClient'

export async function generateMetadata({ params }){
  const resolvedParams = await params
  const item = await getAnimeBySlugFromRepo(resolvedParams.slug)
  return {
    title: `${item.title} смотреть онлайн — Aianime`,
    description: item.description?.slice(0, 160) || 'Аниме онлайн: описание, серии, комментарии и похожие тайтлы.',
    openGraph: { title: item.title, description: item.description, images: [item.poster] }
  }
}

function statusLabel(status){
  if(status === 'ongoing') return 'Выходит'
  if(status === 'anons') return 'Анонс'
  return 'Завершён'
}

function genreSlug(text){
  return String(text).toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,'-').replace(/^-|-$/g,'')
}

export default async function AnimePage({ params }){
  const resolvedParams = await params
  const allAnime = await getAnimeList({limit:1000})
  const item = await getAnimeBySlugFromRepo(resolvedParams.slug)
  const episodes = await getEpisodesBySlug(item.slug, item.episodes || item.episodesList?.length || 12)
  const currentEpisode = episodes[0]
  const nextEpisode = episodes[1] || episodes[0]
  const similar = recommendAnime(allAnime, `похожие на ${item.title}`, { baseAnime: item, limit: 6 })

  const info = [
    ['Статус', statusLabel(item.status)],
    ['Тип', item.kind === 'movie' ? 'Фильм' : 'Сериал'],
    ['Год выхода', item.year || '—'],
    ['Возрастной рейтинг', item.ageRating || '16+'],
    ['Первоисточник', item.source || 'Манга / оригинал'],
    ['Студия', item.studio || '—'],
    ['Режиссёр', item.director || 'Будет добавлено'],
    ['Количество серий', item.episodes || item.episodesList?.length || episodes.length],
    ['Перевод', item.translationTitle || 'Kodik / будет добавлено'],
    ['Озвучка', item.translationTitle || currentEpisode?.voice || 'default'],
  ]

  return <main className="anime-compact-page">
    <nav className="title-top-nav title-top-nav-premium">
      <Link href="/" className="title-nav-brand"><img src="/aianime-logo.png" alt="Aianime"/><div><b>Aianime</b><span>AI anime platform</span></div></Link>
      <div className="title-nav-links">
        <Link href="/">Главная</Link>
        <Link href="/catalog">Каталог</Link>
        <Link href="/genres">Жанры</Link>
        <Link href="/top">Топы</Link>
        <Link href="#player">Плеер</Link>
      </div>
      <div className="title-nav-actions">
        <Link href="/ai" className="title-nav-ai">AI-подбор</Link>
        <Link href="/profile" className="title-nav-profile">Профиль</Link>
      </div>
    </nav>
    <section className="anime-compact-card compact-card-polished"><img className="compact-bg-glow" src={item.poster} alt=""/>
      <div className="anime-compact-left">
        <nav className="compact-breadcrumb"><Link href="/">← На главную</Link><span>/</span><Link href="/catalog">Каталог</Link></nav>

        <h1>{item.title}</h1>

        <div className="compact-aliases">
          <span>{item.originalTitle || item.title}</span>
          <span>{item.kind === 'movie' ? 'Фильм' : 'Сериал'}</span>
          <span>{item.year || '—'}</span>
        </div>

        <div className="compact-rating-row">
          <div className="main-rate"><b>{item.rating || '—'}</b><span>рейтинг</span></div>
          <div className="rate-chip shiki">Shiki {item.rating || '—'}</div>
          <div className="rate-chip ai">AI {Math.min(98, Math.round((Number(item.score || item.rating || 8) || 8) * 10))}%</div>
          <div className="rate-chip mal">MAL {item.rating || '—'}</div>
        </div>

        <div className="compact-info-list">
          {info.map(([label,value])=><div key={label}>
            <span>{label}:</span>
            <b>{value}</b>
          </div>)}
        </div>

        <div className="compact-genres">
          {item.genres.slice(0,8).map(g=><Link href={`/genre/${genreSlug(g)}`} key={g}>{g}</Link>)}
        </div>

        <p className="compact-description">{item.description}</p>

        <div className="compact-actions">
          <Link className="compact-watch" href="#player">▶ Смотреть</Link>
          <Link className="compact-ai" href={`/ai?similar=${item.slug}`}>✦ Похожие через AI</Link>
          <TitleActions item={item}/>
        </div>
      </div>

      <aside className="anime-compact-poster">
        <img src={item.poster} alt={item.title}/>
        <div className="poster-rank">AI рекомендация</div>
      </aside>
    </section>

    <section className="compact-player-section" id="player">
      <div className="compact-section-head"><h2>Плеер</h2><a href="#episodes">Серии ↓</a></div>
      <KodikPlayerClient
        slug={item.slug}
        title={item.title}
        banner={item.banner || item.poster}
        episode={1}
        nextEpisode={nextEpisode?.episodeNumber || 2}
        voice={item.translationTitle || currentEpisode?.voice || 'Kodik'}
        translationTitle={item.translationTitle}
        quality={item.quality}
      />
    </section>

    <section className="compact-episodes" id="episodes">
      <div className="compact-section-head"><h2>Серии</h2><a href="#player">К плееру ↑</a></div>
      <div>
        {episodes.slice(0,32).map((e,index)=><a className={index===0?'active':index<3?'watched':''} href="#player" key={`${e.episodeNumber}-${e.voice || 'default'}`}><span>Серия {e.episodeNumber}</span>{index===0?<em>сейчас</em>:index<3?<em>просмотрено</em>:<em>новая</em>}</a>)}
      </div>
    </section>

    <section className="compact-similar compact-ai-recs">
      <div className="compact-section-head"><h2>Похожие тайтлы</h2><Link href={`/ai?similar=${item.slug}`}>Ещё через AI ›</Link></div>
      <div>
        {similar.map(a=><Link href={`/anime/${a.slug}`} key={a.slug}>
          <img src={a.poster}/>
          <b>{a.title}</b>
          <span>{a.meta}</span>
        </Link>)}
      </div>
    </section>

    <section className="compact-comments">
      <div className="compact-section-head"><h2>Комментарии</h2><a href="#player">К просмотру ↑</a></div>
      <CommentsClient slug={item.slug} title={item.title}/>
    </section>
  </main>
}
