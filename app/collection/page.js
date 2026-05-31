import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = { title:'AIanime', robots:{ index:false, follow:false } }

export default function Page(){
  redirect('/collections')
}
