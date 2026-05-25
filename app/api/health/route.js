import { NextResponse } from 'next/server'
import { collectSiteHealth } from '@/lib/siteHealth'

export const dynamic = 'force-dynamic'

export async function GET(){
  try{
    const health = await collectSiteHealth()
    return NextResponse.json(health, {
      status: health.status === 'degraded' ? 503 : 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Robots-Tag': 'noindex, nofollow',
      }
    })
  }catch(error){
    return NextResponse.json({
      ok:false,
      status:'error',
      error:error?.message || 'Health check failed',
    }, { status:500, headers:{ 'Cache-Control':'no-store, max-age=0', 'X-Robots-Tag':'noindex, nofollow' } })
  }
}
