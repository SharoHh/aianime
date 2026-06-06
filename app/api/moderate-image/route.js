import { NextResponse } from 'next/server'

const bannedWords = [
  'nude','porn','sex','hentai','xxx','nsfw'
]

function isUnsafePrompt(name=''){
  const lower = String(name).toLowerCase()
  return bannedWords.some(word => lower.includes(word))
}

export async function POST(request){
  try{
    const body = await request.json()
    const { name, type, size, dataUrl } = body || {}

    if(!type || !String(type).startsWith('image/')){
      return NextResponse.json({
        ok:false,
        safe:false,
        error:'Можно загружать только изображения.'
      }, { status:400 })
    }

    const sizeMb = Number(size || 0) / 1024 / 1024
    if(sizeMb > 4){
      return NextResponse.json({
        ok:false,
        safe:false,
        error:'Файл слишком большой.'
      }, { status:400 })
    }

    if(isUnsafePrompt(name)){
      return NextResponse.json({
        ok:true,
        safe:false,
        reason:'Подозрительное название файла.'
      })
    }

    // MVP moderation:
    // later can connect OpenAI moderation / AWS Rekognition / Sightengine
    // currently blocks suspicious filenames and invalid mime types

    return NextResponse.json({
      ok:true,
      safe:true,
      provider:'local-basic-moderation'
    })

  }catch(error){
    return NextResponse.json({
      ok:false,
      safe:false,
      error:error?.message || 'Moderation failed'
    }, { status:500 })
  }
}
