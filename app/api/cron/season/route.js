import { NextResponse } from 'next/server'
import { verifyCronAccess } from '@/lib/cronAuth'

export async function GET(request){
  const { searchParams } = new URL(request.url)
  const auth = verifyCronAccess(request)
  if(!auth.ok){
    return NextResponse.json({ ok:false, error:auth.error, hint:auth.hint }, { status:401 })
  }
  const secret = process.env.CRON_SECRET || 'dev-cron-token'

  try{
    const baseUrl = new URL(request.url).origin
    const syncUrl = `${baseUrl}/api/cron/sync?token=${encodeURIComponent(secret)}&enable=1&pages=20&limit=25`
    const res = await fetch(syncUrl, { cache:'no-store' })
    const payload = await res.json().catch(()=>null)

    return NextResponse.json({
      ok: Boolean(payload?.ok),
      source:'season-refresh',
      message:'Сезонное обновление запускает основной sync и обновляет локальную базу.',
      sync: payload
    })
  }catch(error){
    return NextResponse.json({
      ok:false,
      source:'season-refresh',
      error:error?.message || 'Unknown error'
    }, { status:200 })
  }
}
