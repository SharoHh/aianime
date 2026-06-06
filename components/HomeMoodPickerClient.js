'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

const moodIcons = {
  sad: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 10h.01M15.5 10h.01M8.5 16c1.8-1.7 5.2-1.7 7 0"/></svg>,
  calm: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 10h.01M15.5 10h.01M8.5 16c1.8-1.7 5.2-1.7 7 0"/></svg>,
  happy: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 10h.01M15.5 10h.01M8.2 14.2c1.8 2 5.8 2 7.6 0"/></svg>,
  tired: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M7.5 7.5l9 9M16.5 7.5l-9 9"/></svg>,
  inspired: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/><path d="M10 12h4M12 10v4"/></svg>,
}

const moods = [
  { icon:'sad', label:'Грустный', query:'эмоциональное драматичное аниме с сильной историей', keys:['Драма','Романтика','Повседневность'] },
  { icon:'calm', label:'Спокойный', query:'спокойное уютное аниме на вечер', keys:['Повседневность','Романтика','Комедия'] },
  { icon:'happy', label:'Радостный', query:'лёгкое позитивное аниме без тяжёлой драмы для хорошего настроения', keys:['Комедия','Приключения','Повседневность'] },
  { icon:'tired', label:'Уставший', query:'короткое лёгкое аниме без тяжёлого сюжета на один вечер', keys:['Повседневность','Комедия','Романтика'] },
  { icon:'inspired', label:'Вдохновлённый', query:'динамичное аниме с приключениями и ростом героя', keys:['Экшен','Приключения','Фэнтези','Сёнен'] },
]

const messages = {
  'Грустный': 'Мы подберем аниме, которые мягко проживаются вместе с тобой.',
  'Спокойный': 'Мы подберем спокойные тайтлы для уютного вечера.',
  'Радостный': 'Мы подберем аниме, которые поднимут тебе настроение!',
  'Уставший': 'Мы подберем лёгкие тайтлы без перегруза и тяжёлого сюжета.',
  'Вдохновлённый': 'Мы подберем истории про рост, мечту и движение вперёд.'
}

function scoreByMood(item, mood){
  const genres = Array.isArray(item?.genres) ? item.genres : []
  let score = Number(item?.score || item?.rating || 0) || 0
  score += genres.filter(g => mood.keys.includes(g)).length * 10
  if(mood.label === 'Уставший' && Number(item?.episodes || 0) > 0 && Number(item?.episodes || 0) <= 13) score += 8
  if(mood.label === 'Вдохновлённый' && ['ongoing','completed'].includes(item?.status)) score += 4
  return score
}

export default function HomeMoodPickerClient({ anime = [] }){
  const [active, setActive] = useState(2)
  const mood = moods[active]
  useMemo(() => {
    const list = Array.isArray(anime) ? anime : []
    return [...list].sort((a,b) => scoreByMood(b, mood) - scoreByMood(a, mood)).slice(0, 1)[0] || list[0]
  }, [anime, mood])

  return <div className="widget mood mood-reference">
    <div className="widget-head"><h3>AI-подбор по настроению</h3><Link href="/ai">Как это работает?</Link></div>

    <div className="moods mood-reference-tabs">
      {moods.map((m,i)=><button type="button" className={i===active?'sel':''} key={m.label} onClick={()=>setActive(i)}>
        <i>{moodIcons[m.icon]}</i>
        <span>{m.label}</span>
      </button>)}
    </div>

    <div className="mood-reference-card">
      <div className="mood-reference-copy">
        <p>{messages[mood.label]}</p>
        <Link className="bot-action" href={`/ai?q=${encodeURIComponent(mood.query)}`}>Подобрать ✨</Link>
      </div>
      <img className="mood-assistant" src="/images/ai-assistant-320.webp" alt="AI помощник" loading="lazy" decoding="async"/>
    </div>
  </div>
}
