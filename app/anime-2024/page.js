import YearAnimeLanding, { generateYearMetadata } from '@/components/YearAnimeLanding'

export const dynamic = 'force-dynamic'

export async function generateMetadata(){
  return generateYearMetadata(2024)
}

export default function AnimeYearPage(){
  return <YearAnimeLanding year={2024}/>
}
