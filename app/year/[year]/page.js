import { notFound } from 'next/navigation'
import YearAnimeLanding, { generateYearMetadata } from '@/components/YearAnimeLanding'

export const dynamic = 'force-dynamic'

function parseYear(value){
  const year = Number(value)
  const current = new Date().getFullYear() + 1
  return Number.isFinite(year) && year >= 1990 && year <= current ? Math.floor(year) : null
}

export async function generateMetadata({ params }){
  const { year } = await params
  const safeYear = parseYear(year)
  if(!safeYear) return { title:'Год не найден — AIanime', robots:{ index:false, follow:false } }
  return generateYearMetadata(safeYear)
}

export default async function YearPage({ params }){
  const { year } = await params
  const safeYear = parseYear(year)
  if(!safeYear) notFound()
  return <YearAnimeLanding year={safeYear}/>
}
