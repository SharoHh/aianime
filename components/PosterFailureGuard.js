'use client'

import { useEffect } from 'react'

const CARD_SELECTOR = [
  'a.poster',
  'a.catalog-card',
  'a.home-new-card',
  'a.popular-live-card',
  'a.ai-result-card',
  'a.global-search-item',
  'a.mini',
  'a.sch',
  'a.schedule-release',
  'a.continue-card',
  'a.watch-banner',
  'a.taste-rec-card',
  'article.notification-card',
  'article.profile-library-card',
  'article.local-library-card'
].join(',')

function looksLikeAnimePoster(image){
  if(!image || image.tagName !== 'IMG') return false
  const alt = String(image.getAttribute('alt') || '').toLowerCase()
  const src = String(image.getAttribute('src') || '').toLowerCase()
  if(alt.includes('постер аниме') || alt.includes('обложка аниме')) return true
  if(src.includes('/api/image?') || src.includes('/api/poster?')) return Boolean(image.closest(CARD_SELECTOR))
  return false
}

export default function PosterFailureGuard(){
  useEffect(() => {
    function onImageError(event){
      const image = event.target
      if(!looksLikeAnimePoster(image)) return
      const card = image.closest(CARD_SELECTOR) || image.closest('a')
      if(card){
        card.setAttribute('data-poster-failed', '1')
        card.style.display = 'none'
        return
      }
      image.style.display = 'none'
    }

    window.addEventListener('error', onImageError, true)
    return () => window.removeEventListener('error', onImageError, true)
  }, [])

  return null
}
