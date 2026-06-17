import { verifyCronAccess, cronAuthError } from '@/lib/cronAuth'
import { enrichCatalogBatch, parseCatalogEnrichmentParams } from '@/lib/catalogEnrichmentBatch'

export async function GET(request){
  const auth = verifyCronAccess(request)
  if(!auth.ok) return cronAuthError(auth)
  const { searchParams } = new URL(request.url)
  const params = parseCatalogEnrichmentParams(searchParams)
  const startedAt = new Date().toISOString()

  try{
    const result = await enrichCatalogBatch(params)
    return Response.json({
      ok:Boolean(result?.ok),
      source:'enrich-catalog',
      requested:params,
      ...result,
      auth:auth.mode,
      startedAt,
      finishedAt:new Date().toISOString(),
      hint:'Запускай маленькими пачками: types=ona,special,ova&limit=5-10&delay=2000. Для одного тайтла используй slug=...'
    })
  }catch(error){
    return Response.json({ ok:false, source:'enrich-catalog', requested:params, error:error?.message || String(error), startedAt, finishedAt:new Date().toISOString() }, { status:200 })
  }
}
