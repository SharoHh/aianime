'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import HomeSectionIcon from '@/components/HomeSectionIcon'

const questions = [
  { key:'mood', title:'Какой вайб нужен?', options:['Уютный','Мрачный','Весёлый','Динамичный'] },
  { key:'length', title:'По длине?', options:['Короткое','Среднее','Длинное','Фильм'] },
  { key:'genre', title:'Ближе жанр?', options:['Романтика','Экшен','Психология','Фэнтези'] },
  { key:'energy', title:'Насколько тяжёлый сюжет?', options:['Лёгкий','Средний','Серьёзный','Без разницы'] },
]

function score(item, answers){
  const text = `${item.title} ${item.description} ${(item.genres || []).join(' ')}`.toLowerCase()
  let s = Number(item.score || item.rating || 0) * 6
  Object.values(answers).forEach(answer => {
    const a = String(answer).toLowerCase()
    if(text.includes(a)) s += 20
    if(a.includes('корот') && Number(item.episodes || 0) <= 13) s += 18
    if(a.includes('фильм') && item.kind === 'movie') s += 18
    if(a.includes('длин') && Number(item.episodes || 0) > 24) s += 18
    if(a.includes('экшен') && item.genres?.includes('Экшен')) s += 20
    if(a.includes('роман') && item.genres?.includes('Романтика')) s += 20
    if(a.includes('фэнтези') && item.genres?.includes('Фэнтези')) s += 20
    if(a.includes('психолог') && item.genres?.includes('Психология')) s += 20
  })
  return s
}

export default function AiQuizClient({ items = [] }){
  const [answers,setAnswers] = useState({})

  const results = useMemo(()=>{
    if(Object.keys(answers).length < 2) return []
    return [...items].map(item=>({...item, quizScore:score(item, answers)})).sort((a,b)=>b.quizScore-a.quizScore).slice(0,6)
  }, [items, answers])

  return <>
    <section className="widget ai-quiz">
      {questions.map(q=><div className="ai-quiz-question" key={q.key}>
        <h3>{q.title}</h3>
        <div>{q.options.map(option=><button className={answers[q.key]===option?'active':''} onClick={()=>setAnswers({...answers,[q.key]:option})} key={option}>{option}</button>)}</div>
      </div>)}
    </section>

    <div className="section-title"><h2><HomeSectionIcon type="ai"/>Результат</h2><Link href="/ai">Обычный AI ›</Link></div>
    {results.length ? <div className="ai-results-grid">{results.map(item=><Link className="ai-result-card" href={`/anime/${item.slug}`} key={item.slug}>
      <img loading="lazy" decoding="async" src={item.poster}/>
      <div><span>AI {Math.min(99, Math.round(item.quizScore))}%</span><b>{item.title}</b><p>{item.description}</p><em>{(item.genres || []).slice(0,2).join(' · ')}</em></div>
    </Link>)}</div> : <div className="empty-state">Ответь минимум на 2 вопроса.</div>}
  </>
}
