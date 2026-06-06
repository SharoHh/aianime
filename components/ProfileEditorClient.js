'use client'

import { useEffect, useState } from 'react'
import { pushToast } from '@/components/ToastCenter'
import { getProfileDefaults, readStoredProfile, restoreProfileFromCloud, saveProfileToCloud, saveStoredProfile } from '@/components/AuthStateClient'

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

  useEffect(()=>{
    let active = true
    setProfile(readStoredProfile(user))
    restoreProfileFromCloud(user).then(result => {
      if(active && result?.profile) setProfile(result.profile)
    }).catch(() => {})
    return () => { active = false }
  }, [user])

  function update(key, value){
    setProfile(prev => ({ ...(prev || getProfileDefaults(user)), [key]: value }))
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
    const next = profile || getProfileDefaults(user)
    saveStoredProfile(user, next)
    try{
      await saveProfileToCloud(user, next)
      pushToast('Профиль сохранён в аккаунте', 'success')
    }catch{
      pushToast('Профиль сохранён локально. Supabase временно недоступен', 'info')
    }
  }

  async function reset(){
    const defaults = getProfileDefaults(user)
    setProfile(defaults)
    saveStoredProfile(user, defaults)
    try{ await saveProfileToCloud(user, defaults) }catch{}
    pushToast('Профиль сброшен', 'success')
  }

  if(!profile){
    return <section className="profile-clean-card widget profile-loading-card"/>
  }

  return <section className="profile-clean-card widget profile-editor-v7">
    <div className="profile-preview-v7">
      <div className="profile-cover-stage-v7">
        <img className="profile-clean-cover" src={profile.cover} alt="Фон профиля"/>
        <div className="profile-cover-shade-v7"/>
        <div className="profile-cover-info-v7">
          <img className="profile-clean-avatar" src={profile.avatar} alt="Аватар"/>
          <div>
            <span>ваш профиль</span>
            <h2>{profile.name}</h2>
            <p>{profile.level}</p>
          </div>
        </div>
      </div>
      <p className="profile-preview-note-v7">Так профиль будет выглядеть в меню и на странице аккаунта.</p>
    </div>

    <div className="profile-clean-form profile-form-v7">
      <div className="profile-clean-head">
        <span>настройки</span>
        <h3>Профиль</h3>
        <p>Настрой имя, статус, аватар и фон. Изменения сохраняются в аккаунте и сразу обновляют меню сайта.</p>
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
          <span>Фон профиля</span>
          <b>JPG, PNG или WEBP до 4 МБ</b>
          <strong>Выбрать фон</strong>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>upload('cover', e.target.files?.[0])}/>
        </label>
      </div>

      <details className="profile-advanced-v7">
        <summary>Указать картинку ссылкой</summary>
        <div className="profile-clean-grid">
          <label><span>Аватар URL</span><input value={profile.avatar} onChange={e=>update('avatar', e.target.value)} placeholder="/posters/oshi.svg"/></label>
          <label><span>Фон URL</span><input value={profile.cover} onChange={e=>update('cover', e.target.value)} placeholder="/images/profile-sidebar-bg.png"/></label>
        </div>
      </details>

      <div className="profile-clean-actions">
        <button className="primary" onClick={save}>Сохранить профиль</button>
        <button className="secondary" onClick={reset}>Сбросить</button>
      </div>
    </div>
  </section>
}
