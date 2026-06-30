import { NextResponse } from 'next/server'
import { getSiteStatsSnapshot } from '@/lib/siteStats'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(){
  const stats = await getSiteStatsSnapshot()
  return NextResponse.json(stats, {
    status:200,
    headers:{
      'Cache-Control':'no-store, max-age=0',
      'X-Robots-Tag':'noindex, nofollow',
    },
  })
}
