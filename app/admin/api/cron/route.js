import { NextResponse } from 'next/server'

const jobs = {
  sync: { label:'Jikan каталог', path:'/api/cron/sync', params:{ enable:'1', limit:'25' } },
  kodik: { label:'Kodik metadata', path:'/api/cron/sync-kodik', params:{ enable:'1', limit:'30', all:'1' } },
  players: { label:'Kodik players', path:'/api/cron/players', params:{ enable:'1', limit:'30' } },
  schedule: { label:'Расписание', path:'/api/cron/schedule', params:{ enable:'1', limit:'25', pages:'2' } },
  titles: { label:'Русские названия', path:'/api/cron/russify-titles', params:{ enable:'1', limit:'80' } },
  russify: { label:'Описание/жанры', path:'/api/cron/russify', params:{ enable:'1', limit:'80' } },
}

function json(data, status = 200){
  return NextResponse.json(data, { status })
}

function buildUrl(base, job, extra = {}){
  const url = new URL(job.path, base)
  const params = { ...job.params, ...extra }
  Object.entries(params).forEach(([key,value]) => {
    if(value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  })
  const token = process.env.CRON_SECRET || process.env.AIANIME_CRON_SECRET || ''
  if(token) url.searchParams.set('token', token)
  return url
}

export async function GET(){
  return json({
    ok:true,
    jobs:Object.entries(jobs).map(([id,job]) => ({ id, label:job.label, path:job.path })),
    hasCronSecret:Boolean(process.env.CRON_SECRET || process.env.AIANIME_CRON_SECRET),
  })
}

export async function POST(request){
  let body = {}
  try{ body = await request.json() }catch{}

  const jobId = String(body.job || '').trim()
  const job = jobs[jobId]
  if(!job) return json({ ok:false, error:'Unknown cron job' }, 400)

  const secret = process.env.CRON_SECRET || process.env.AIANIME_CRON_SECRET || ''
  if(!secret){
    return json({ ok:false, error:'CRON_SECRET is not configured in .env.local' }, 400)
  }

  const base = process.env.AIANIME_INTERNAL_URL || process.env.AIANIME_URL || 'http://127.0.0.1:3000'
  const allowedExtra = {}
  for(const key of ['limit','offset','pages','page','all','dry','force','onlyMissing','clean','only','minDescriptionLength']){
    if(body[key] !== undefined && body[key] !== null && body[key] !== '') allowedExtra[key] = body[key]
  }

  const url = buildUrl(base, job, allowedExtra)
  const startedAt = new Date().toISOString()
  try{
    const res = await fetch(url, { cache:'no-store' })
    const text = await res.text()
    let payload = null
    try{ payload = text ? JSON.parse(text) : null }catch{}
    return json({
      ok:res.ok && payload?.ok !== false,
      status:res.status,
      job:jobId,
      label:job.label,
      path:job.path,
      payload:payload || text,
      startedAt,
      finishedAt:new Date().toISOString(),
    }, res.ok ? 200 : 500)
  }catch(error){
    return json({ ok:false, job:jobId, error:error?.message || String(error), startedAt, finishedAt:new Date().toISOString() }, 500)
  }
}
