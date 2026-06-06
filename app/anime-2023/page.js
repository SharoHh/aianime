import YearAnimeLanding, { generateYearMetadata } from '@/components/YearAnimeLanding'

export const dynamic = 'force-dynamic'

export async function generateMetadata(){
  return generateYearMetadata(2023)
}

export default function AnimeYearPage(){
  return <YearAnimeLanding year={2023}/>
}
