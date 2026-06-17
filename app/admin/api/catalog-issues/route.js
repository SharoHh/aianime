import { NextResponse } from 'next/server'
import { hasSupabase, supabaseRequest } from '@/lib/supabaseServer'
import { cleanPublicText } from '@/lib/ruContent'

const BAD_SYMBOL_RE = /[●•◆■□◦]{2,}|[�]/
const ENGLISH_GENRE_RE = /\b(Urban Fantasy|Slice of Life|Award Winning|Supernatural|Suspense|Avant Garde|Girls Love|Boys Love|Romance|Comedy|Action|Adventure|Fantasy|Drama|Horror|Sci-Fi|Sports|Mystery|Psychological|Thriller|School)\b/i
const PLACEHOLDER_RE = /будет добавлено|описание скоро|default|^—$/i

function json(data, status = 200){
  return NextResponse.json(data, {
    status,
    headers:{ 'Cache-Control':'no-store, max-age=0', 'X-Robots-Tag':'noindex, nofollow' }
  })
}

function clean(value, max = 240){
  return cleanPublicText(String(value || '').replace(/\s+/g, ' ').trim()).slice(0, max)
}

function issueItem(row, issue, severity = 'warning', hint = ''){
  return {
    slug: row.slug,
    title: clean(row.title_ru || row.title || row.original_title || row.slug, 140),
    originalTitle: clean(row.original_title || row.title || '', 160),
    year: row.year || null,
    kind: row.kind || '',
    status: row.status || '',
    posterUrl: row.poster_url || '',
    issue,
    severity,
    hint
  }
}

async function readAnimeRows(){
  const select = 'slug,title,title_ru,original_title,description,description_ru,poster_url,genres,status,kind,year,episodes,kodik_id,kodik_link,updated_at'
  for(const query of [`anime?select=${encodeURIComponent(select)}&order=updated_at.desc.nullslast&limit=1200`, 'anime?select=*&limit=1200']){
    const res = await supabaseRequest(query, { method:'GET', timeout:12000 })
    const text = await res.text()
    let rows = []
    try{ rows = text ? JSON.parse(text) : [] }catch{}
    if(res.ok && Array.isArray(rows)) return rows
  }
  return []
}

async function readEpisodeSlugs(){
  try{
    const res = await supabaseRequest('anime_episodes?select=anime_slug,episode_number,voice,status&limit=50000', { method:'GET', timeout:16000 })
    const text = await res.text()
    let rows = []
    try{ rows = text ? JSON.parse(text) : [] }catch{}
    if(!res.ok || !Array.isArray(rows)) return new Map()
    const map = new Map()
    for(const row of rows){
      const slug = String(row?.anime_slug || '').trim()
      if(!slug) continue
      const current = map.get(slug) || { rows:0, episodes:new Set(), voices:new Set() }
      current.rows += 1
      if(row?.episode_number) current.episodes.add(Number(row.episode_number))
      if(row?.voice) current.voices.add(String(row.voice))
      map.set(slug, current)
    }
    return map
  }catch{
    return new Map()
  }
}

function isMissing(value){
  const text = String(value || '').trim()
  return !text || PLACEHOLDER_RE.test(text)
}


function isLocalSvgPoster(value){
  const poster = String(value || '').trim().toLowerCase()
  if(!poster) return false
  let decoded = poster
  try{ decoded = decodeURIComponent(poster).toLowerCase() }catch{}
  return [poster, decoded].some(item => /^\/posters\/[^?#]+\.svg(?:[?#].*)?$/.test(item))
}

function isBadPosterUrl(value){
  const poster = String(value || '').trim()
  if(!poster) return true
  if(isLocalSvgPoster(poster)) return true
  if(/placeholder|no[-_]?poster|default/i.test(poster)) return true
  return false
}

function hasEnglishGenres(row){
  const genres = Array.isArray(row.genres) ? row.genres.join(' ') : String(row.genres || '')
  const description = `${row.description_ru || ''} ${row.description || ''}`
  return ENGLISH_GENRE_RE.test(`${genres} ${description}`)
}

export async function GET(){
  try{
    if(!hasSupabase()) return json({ ok:false, error:'Supabase env is not configured' }, 400)
    const [animeRows, episodeMap] = await Promise.all([readAnimeRows(), readEpisodeSlugs()])
    const issues = []

    for(const row of animeRows){
      const titleRu = String(row.title_ru || '').trim()
      const titleBlob = `${row.title || ''} ${row.title_ru || ''} ${row.original_title || ''}`
      const episodes = episodeMap.get(row.slug)
      const episodeCount = episodes?.episodes?.size || 0
      const voiceCount = episodes?.voices?.size || 0
      const expectedEpisodes = Number(row.episodes || 0) || 0

      if(!titleRu) issues.push(issueItem(row, 'missing_title_ru', 'warning', 'Нет русского названия'))
      if(BAD_SYMBOL_RE.test(titleBlob)) issues.push(issueItem(row, 'bad_title_symbols', 'error', 'В названии есть мусорные символы'))
      if(isBadPosterUrl(row.poster_url)) issues.push(issueItem(row, 'missing_poster', 'warning', 'Нет реального постера: локальная SVG-заглушка или пустой poster_url'))
      if(isMissing(row.description_ru || row.description)) issues.push(issueItem(row, 'missing_description_ru', 'warning', 'Нет нормального русского описания'))
      if(hasEnglishGenres(row)) issues.push(issueItem(row, 'english_ru_content', 'warning', 'Английские жанры/слова в RU-контенте'))
      if(!String(row.kodik_id || row.kodik_link || '').trim()) issues.push(issueItem(row, 'missing_kodik', 'warning', 'Нет Kodik id/link'))
      if(String(row.status || '').toLowerCase() !== 'anons' && expectedEpisodes !== 1 && episodeCount === 0){
        issues.push(issueItem(row, 'missing_player_episodes', 'error', 'Нет сохранённых серий в anime_episodes'))
      }
      if(expectedEpisodes > 1 && episodeCount > 0 && episodeCount < Math.min(expectedEpisodes, 12)){
        issues.push(issueItem(row, 'partial_player_episodes', 'warning', `Серий в базе: ${episodeCount} из ${expectedEpisodes}`))
      }
      if(episodeCount > 0 && voiceCount <= 1 && expectedEpisodes > 12){
        issues.push(issueItem(row, 'few_player_voices', 'info', `Мало озвучек: ${voiceCount || 1}`))
      }
    }

    const summary = issues.reduce((acc, item) => {
      acc.total += 1
      acc.byIssue[item.issue] = (acc.byIssue[item.issue] || 0) + 1
      acc.bySeverity[item.severity] = (acc.bySeverity[item.severity] || 0) + 1
      return acc
    }, { total:0, byIssue:{}, bySeverity:{ error:0, warning:0, info:0 } })

    const priority = { error:0, warning:1, info:2 }
    issues.sort((a,b) => (priority[a.severity] ?? 5) - (priority[b.severity] ?? 5) || a.issue.localeCompare(b.issue, 'ru') || a.title.localeCompare(b.title, 'ru'))

    return json({ ok:true, animeCount:animeRows.length, episodeSlugCount:episodeMap.size, summary, issues:issues.slice(0, 240) })
  }catch(error){
    return json({ ok:false, error:error?.message || 'Unknown error' }, 500)
  }
}
