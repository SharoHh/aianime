'use client'

import Link from 'next/link'

const routes = [
  `/ai?q=${encodeURIComponent('тёплые добрые аниме когда грустно')}`,
  `/catalog?genre=${encodeURIComponent('Приключения')}&sort=rating`,
  `/ai?q=${encodeURIComponent('лёгкое уютное аниме для отдыха')}`,
  '/catalog?year=2024&sort=rating',
  '/catalog?sort=rating',
]

export default function HomeCollectionsClient({ collections = [] }){
  return <div className="collections">
    {collections.map((c, i) => <Link
      href={routes[i] || '/collections'}
      className="collection"
      key={c[0]}
      title={`Открыть подборку: ${c[0]}`}
    >
      <div><b>{c[0]}</b><span>{c[1]}</span></div><em>{c[2]}</em>
    </Link>)}
  </div>
}
