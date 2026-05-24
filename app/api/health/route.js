import { hasSupabase } from '@/lib/supabaseServer'
import { anime } from '@/lib/data'

export async function GET(){
  return Response.json({
    ok:true,
    runtime:'local-safe',
    homepageDependsOnExternalApi:false,
    externalImagesEnabled: process.env.ENABLE_REMOTE_IMAGES === '1' || process.env.NEXT_PUBLIC_ENABLE_REMOTE_IMAGES === '1',
    jikanSyncEnabled: process.env.ENABLE_JIKAN_SYNC === '1',
    supabaseConfigured: hasSupabase(),
    seedCount: anime.length,
    hint:'Если /api/health открывается, Next.js сервер жив. Jikan sync запускается отдельно через /api/cron/sync?enable=1.'
  })
}
