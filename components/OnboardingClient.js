'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function OnboardingClient(){
  const [show,setShow] = useState(false)

  useEffect(()=>{
    try{
      if(localStorage.getItem('anime:onboarding-done') !== '1') setShow(true)
    }catch{}
  }, [])

  function close(){
    try{ localStorage.setItem('anime:onboarding-done', '1') }catch{}
    setShow(false)
  }

  if(!show) return null

  return <div className="onboarding-card">
    <button className="onboarding-close" onClick={close}>×</button>
    <span>быстрый старт</span>
    <h3>Добро пожаловать в Aianime</h3>
    <p>Начни с каталога, AI-подбора или открой любой тайтл — история и продолжить просмотр сохранятся автоматически.</p>
    <div>
      <Link href="/ai" onClick={close}>AI-подбор</Link>
      <Link href="/catalog" onClick={close}>Каталог</Link>
      <button onClick={close}>Понятно</button>
    </div>
  </div>
}
