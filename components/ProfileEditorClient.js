'use client'

import { useEffect, useState } from 'react'
import { pushToast } from '@/components/ToastCenter'

const defaults = {
  name: 'Haruno',
  level: 'Уровень 12',
  avatar: '/posters/oshi.svg',
  cover: '/images/profile-sidebar-bg.png'
}

function readProfile(){
  try{
    return { ...defaults, ...JSON.parse(localStorage.getItem('anime:profile') || '{}') }
  }catch{
    return defaults
  }
}

function saveProfile(profile){
  localStorage.setItem('anime:profile', JSON.stringify(profile))
  window.dispatchEvent(new Event('anime:user-updated'))
}

function fileToDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ProfileEditorClient(){
  const [profile,setProfile] = useState(null)

  useEffect(()=>setProfile(readProfile()), [])

  function update(key, value){
    setProfile(prev => ({ ...(prev || defaults), [key]: value }))
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
    pushToast('Изображение загружено', 'success')
  }

  function save(){
    saveProfile(profile || defaults)
    pushToast('Профиль обновлён', 'success')
  }

  function reset(){
    setProfile(defaults)
    saveProfile(defaults)
    pushToast('Профиль сброшен', 'success')
  }

  if(!profile){
    return <section className="profile-clean-card widget profile-loading-card"/>
  }

  return <section className="profile-clean-card widget">
    <div className="profile-clean-preview">
      <div className="profile-clean-top">
        <img className="profile-clean-avatar" src={profile.avatar} alt="Аватар"/>
        <div>
          <span>профиль</span>
          <h2>{profile.name}</h2>
          <p>{profile.level}</p>
        </div>
      </div>
      <img className="profile-clean-cover" src={profile.cover} alt="Фон профиля"/>
    </div>

    <div className="profile-clean-form">
      <div className="profile-clean-head">
        <span>настройки</span>
        <h3>Профиль</h3>
        <p>Меняй имя, уровень, аватар и фон. Данные сохраняются локально и сразу обновляют левое меню.</p>
      </div>

      <div className="profile-clean-grid">
        <label><span>Имя</span><input value={profile.name} onChange={e=>update('name', e.target.value)} placeholder="Haruno"/></label>
        <label><span>Уровень</span><input value={profile.level} onChange={e=>update('level', e.target.value)} placeholder="Уровень 12"/></label>
        <label><span>Аватар URL</span><input value={profile.avatar} onChange={e=>update('avatar', e.target.value)} placeholder="/posters/oshi.svg"/></label>
        <label><span>Фон URL</span><input value={profile.cover} onChange={e=>update('cover', e.target.value)} placeholder="/images/profile-sidebar-bg.png"/></label>
        <label><span>Загрузить аватар</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>upload('avatar', e.target.files?.[0])}/></label>
        <label><span>Загрузить фон</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>upload('cover', e.target.files?.[0])}/></label>
      </div>

      <div className="profile-clean-actions">
        <button className="primary" onClick={save}>Сохранить</button>
        <button className="secondary" onClick={reset}>Сбросить</button>
      </div>
    </div>
  </section>
}
