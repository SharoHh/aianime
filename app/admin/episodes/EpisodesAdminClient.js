'use client'

import { useEffect, useMemo, useState } from 'react'

export default function EpisodesAdminClient(){
  const [anime, setAnime] = useState([])
  const [selected, setSelected] = useState('')
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ episode_number: 1, title: '', provider: 'manual', voice: 'default', embed_url: '', hls_url: '', status: 'published' })

  useEffect(() => {
    fetch('/admin/api/episodes')
      .then(r => r.json())
      .then(data => {
        const list = data.anime || []
        setAnime(list)
        if(list[0]) setSelected(list[0].slug)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if(!selected) return
    setMessage('')
    fetch(`/admin/api/episodes?slug=${encodeURIComponent(selected)}`)
      .then(r => r.json())
      .then(data => {
        const list = data.episodes || []
        setEpisodes(list)
        setForm(prev => ({ ...prev, episode_number: list[0]?.episodeNumber || 1, title: `Серия ${list[0]?.episodeNumber || 1}` }))
      })
  }, [selected])

  const currentAnime = useMemo(() => anime.find(item => item.slug === selected), [anime, selected])

  async function saveEpisode(event){
    event.preventDefault()
    setSaving(true)
    setMessage('')
    const payload = {
      anime_slug: selected,
      episode_number: Number(form.episode_number),
      title: form.title || `Серия ${form.episode_number}`,
      provider: form.provider || 'manual',
      voice: form.voice || 'default',
      embed_url: form.embed_url || null,
      hls_url: form.hls_url || null,
      status: form.status || 'published',
      source: 'admin',
    }
    try{
      const res = await fetch('/admin/api/episodes', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if(!data.ok) throw new Error(data.error || 'Не удалось сохранить')
      setMessage('Серия сохранена')
      const refreshed = await fetch(`/admin/api/episodes?slug=${encodeURIComponent(selected)}`).then(r => r.json())
      setEpisodes(refreshed.episodes || [])
    }catch(error){
      setMessage(error?.message || 'Ошибка сохранения')
    }finally{
      setSaving(false)
    }
  }

  async function generatePlaceholders(){
    setSaving(true)
    setMessage('')
    try{
      const res = await fetch('/api/cron/episodes?token=dev-cron-token&limit=120')
      const data = await res.json()
      if(!data.ok) throw new Error(data.error || 'Не удалось создать серии')
      setMessage(`Создано/обновлено серий: ${data.saved || data.generated || 0}`)
      if(selected){
        const refreshed = await fetch(`/admin/api/episodes?slug=${encodeURIComponent(selected)}`).then(r => r.json())
        setEpisodes(refreshed.episodes || [])
      }
    }catch(error){
      setMessage(error?.message || 'Ошибка')
    }finally{
      setSaving(false)
    }
  }

  return <div className="admin-episodes">
    <div className="widget admin-panel">
      <div className="widget-head"><h3>Серии и будущий плеер</h3><button onClick={generatePlaceholders} disabled={saving}>{saving ? 'Работаю...' : 'Создать серии автоматически'}</button></div>
      <p className="admin-muted">Сейчас серии можно добавить вручную. Позже этот же слой будет обновляться автоматическим источником: cron будет заполнять embed_url/hls_url, а дизайн страницы просмотра менять не придётся.</p>
      {message ? <div className="admin-message">{message}</div> : null}
      {loading ? <p>Загрузка...</p> : <div className="admin-grid">
        <aside className="admin-list">
          {anime.map(item => <button className={item.slug === selected ? 'active' : ''} onClick={() => setSelected(item.slug)} key={item.slug}>
            <img src={item.poster}/><span>{item.title}</span><em>{item.episodes || 12} серий</em>
          </button>)}
        </aside>
        <section className="admin-editor">
          <div className="admin-current">
            {currentAnime?.poster ? <img src={currentAnime.poster}/> : null}
            <div><b>{currentAnime?.title || 'Выбери тайтл'}</b><span>{selected}</span></div>
          </div>
          <form onSubmit={saveEpisode} className="episode-form">
            <label>Номер серии<input type="number" min="1" value={form.episode_number} onChange={e=>setForm({...form, episode_number:e.target.value, title:`Серия ${e.target.value}`})}/></label>
            <label>Название<input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Серия 1"/></label>
            <label>Провайдер<input value={form.provider} onChange={e=>setForm({...form, provider:e.target.value})} placeholder="manual"/></label>
            <label>Озвучка<input value={form.voice} onChange={e=>setForm({...form, voice:e.target.value})} placeholder="default"/></label>
            <label className="wide">Embed URL<input value={form.embed_url} onChange={e=>setForm({...form, embed_url:e.target.value})} placeholder="https://... iframe/embed"/></label>
            <label className="wide">HLS URL<input value={form.hls_url} onChange={e=>setForm({...form, hls_url:e.target.value})} placeholder="https://.../index.m3u8"/></label>
            <label>Статус<select value={form.status} onChange={e=>setForm({...form, status:e.target.value})}><option value="published">published</option><option value="draft">draft</option><option value="placeholder">placeholder</option></select></label>
            <button disabled={saving || !selected}>{saving ? 'Сохраняю...' : 'Сохранить серию'}</button>
          </form>
          <div className="episode-admin-list">
            <h4>Серии тайтла</h4>
            {episodes.map(ep => <div key={`${ep.episodeNumber}-${ep.provider}-${ep.voice}`}>
              <b>{ep.title || `Серия ${ep.episodeNumber}`}</b><span>{ep.provider} · {ep.voice} · {ep.status}</span><em>{ep.embedUrl || ep.hlsUrl ? 'плеер есть' : 'заглушка'}</em>
            </div>)}
          </div>
        </section>
      </div>}
    </div>
  </div>
}
