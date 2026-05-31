// AIanime v131: /settings is not a separate page anymore. Use profile as the account hub.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Профиль — Aianime',
  description: 'Профиль, избранное, история и персональные данные аккаунта.'
}

export default function SettingsPage(){
  redirect('/profile')
}
