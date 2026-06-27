'use client'

import { useEffect, useState } from 'react'
import { pushToast } from '@/components/ToastCenter'
import { getProfileDefaults, readStoredProfile, restoreProfileFromCloud, saveProfileToCloud, saveStoredProfile } from '@/components/AuthStateClient'

const obsoleteCovers = new Set([
  '/images/profile-sidebar-bg-960.webp',
  '/images/profile-sidebar-bg.webp'
])

function cleanCover(value){
  const text = String(value || '').trim()
  if(!text || obsoleteCovers.has(text)) return ''
  return text
}

function normalizeProfile(profile, user){
  const next = { ...getProfileDefaults(user), ...(profile || {}) }
  return { ...next, cover:cleanCover(next.cover) }
}

function fileToDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ProfileEditorClient({ user }){
  const [profile,setProfile] = useState(null)
  const [coverFailed,setCoverFailed] = useState(false)

  useEffect(()=>{
    let active = true
    setProfile(normalizeProfile(readStoredProfile(user), user))
    restoreProfileFromCloud(user).then(result => {
      if(active && result?.profile) setProfile(normalizeProfile(result.profile, user))
    }).catch(() => {})
    return () => { active = false }
  }, [user])

  function update(key, value){
    if(key === 'cover') setCoverFailed(false)
    setProfile(prev => ({ ...(prev || getProfileDefaults(user)), [key]:key === 'cover' ? cleanCover(value) : value }))
  }

  async function upload(key, file){
    if(!file) return

    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    const maxSizeMb = key === 'cover' ? 4 : 2

    if(!allowed.includes(file.type)){
      pushToast('Можно загружать только JPG, PNG или WEBP', 'error')
      return
    }

    if(file.size > maxSizeMb * 1024 * 1024){
      pushToast(`Файл слишком большой. Лимит: ${maxSizeMb} МБ`, 'error')
      return
    }

    const dataUrl = await fileToDataUrl(file)

    try{
      const moderation = await fetch('/api/moderate-image', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          name:file.name,
          type:file.type,
          size:file.size,
          dataUrl
        })
      })

      const result = await moderation.json()

      if(!result?.safe){
        pushToast(result?.reason || result?.error || 'Изображение не прошло модерацию', 'error')
        return
      }
    }catch{
      pushToast('Ошибка проверки изображения', 'error')
      return
    }

    update(key, dataUrl)
    pushToast(key === 'cover' ? 'Фон обновлён' : 'Аватар обновлён', 'success')
  }

  async function save(){
    const next = normalizeProfile(profile, user)
    saveStoredProfile(user, next)
    try{
      await saveProfileToCloud(user, next)
      pushToast('Профиль сохранён в аккаунте', 'success')
    }catch{
      pushToast('Профиль сохранён локально. Supabase временно недоступен', 'info')
    }
  }

  async function reset(){
    const defaults = normalizeProfile(getProfileDefaults(user), user)
    setProfile(defaults)
    setCoverFailed(false)
    saveStoredProfile(user, defaults)
    try{ await saveProfileToCloud(user, defaults) }catch{}
    pushToast('Профиль сброшен', 'success')
  }

  if(!profile){
    return <section className="profile-clean-card widget profile-loading-card"/>
  }

  const cover = cleanCover(profile.cover)
  const hasCover = Boolean(cover) && !coverFailed

  return <section className="profile-clean-card widget profile-editor-v7 profile-editor-v253">
    <div className="profile-preview-v7">
      <div className={`profile-cover-stage-v7 profile-identity-stage-v253 ${hasCover ? 'has-cover' : 'is-coverless'}`}>
        {hasCover ? <img className="profile-clean-cover" src={cover} alt="Фон профиля" onError={()=>setCoverFailed(true)}/> : null}
        <div className="profile-identity-art-v253" aria-hidden="true">
          <span className="profile-identity-orb-v253 orb-one"/>
          <span className="profile-identity-orb-v253 orb-two"/>
          <span className="profile-identity-ring-v253"/>
          <i>AI</i>
          <em>anime profile</em>
        </div>
        <div className="profile-cover-shade-v7"/>
        <div className="profile-cover-info-v7">
          <span className="profile-avatar-shell-v253">
            <img className="profile-clean-avatar" src={profile.avatar} alt="Аватар" onError={e=>{ e.currentTarget.style.display = 'none' }}/>
          </span>
          <div>
            <span>ваш профиль</span>
            <h2>{profile.name}</h2>
            <p>{profile.level}</p>
          </div>
        </div>
        <div className="profile-identity-caption-v253">
          <b>{profile.bio?.trim() || 'Собирай любимые тайтлы, оценки и историю просмотра в одном месте.'}</b>
        </div>
      </div>
      <p className="profile-preview-note-v7">Фирменный фон работает без картинок. Свой фон можно добавить ниже — если он сломается, профиль автоматически вернётся к этому оформлению.</p>
    </div>

    <div className="profile-clean-form profile-form-v7">
      <div className="profile-clean-head">
        <span>настройки</span>
        <h3>Профиль</h3>
        <p>Настрой имя, статус, аватар и описание. Изменения сохраняются в аккаунте и сразу обновляют меню сайта.</p>
      </div>

      <div className="profile-clean-grid profile-main-fields-v7">
        <label><span>Имя</span><input value={profile.name} onChange={e=>update('name', e.target.value)} placeholder="Имя профиля"/></label>
        <label><span>Статус</span><input value={profile.level} onChange={e=>update('level', e.target.value)} placeholder="Например: смотрю онгоинги"/></label>
      </div>

      <label className="profile-bio-field-v7">
        <span>О себе</span>
        <textarea value={profile.bio || ''} onChange={e=>update('bio', e.target.value)} placeholder="Любимые жанры, настроение или что сейчас смотришь" rows={3}/>
      </label>

      <div className="profile-upload-grid-v7">
        <label className="profile-upload-card-v7">
          <span>Аватар</span>
          <b>JPG, PNG или WEBP до 2 МБ</b>
          <strong>Выбрать аватар</strong>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>upload('avatar', e.target.files?.[0])}/>
        </label>
        <label className="profile-upload-card-v7">
          <span>Свой фон</span>
          <b>Необязательно. Если не загружать — останется фирменное оформление.</b>
          <strong>Выбрать фон</strong>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>upload('cover', e.target.files?.[0])}/>
        </label>
      </div>

      {cover ? <button type="button" className="profile-remove-cover-v253" onClick={()=>update('cover', '')}>Убрать свой фон и вернуть фирменный</button> : null}

      <details className="profile-advanced-v7">
        <summary>Указать картинку ссылкой</summary>
        <div className="profile-clean-grid">
          <label><span>Аватар URL</span><input value={profile.avatar} onChange={e=>update('avatar', e.target.value)} placeholder="https://..."/></label>
          <label><span>Фон URL</span><input value={cover} onChange={e=>update('cover', e.target.value)} placeholder="Оставь пустым для фирменного фона"/></label>
        </div>
      </details>

      <div className="profile-clean-actions">
        <button className="primary" onClick={save}>Сохранить профиль</button>
        <button className="secondary" onClick={reset}>Сбросить</button>
      </div>
    </div>
  </section>
}
