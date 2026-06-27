'use client'

import { useEffect } from 'react'
import { isPlaceholderPoster } from '@/lib/animeQuality'

const ARTICLE_CARD_SELECTOR = [
  'article.notification-card',
  'article.profile-library-card',
  'article.local-library-card'
].join(',')

const LINK_CARD_SELECTOR = [
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
  'a.top-list-item'
].join(',')

const CARD_SELECTOR = `${ARTICLE_CARD_SELECTOR},${LINK_CARD_SELECTOR}`

function posterCard(image){
  if(!image || image.tagName !== 'IMG') return null
  return image.closest(ARTICLE_CARD_SELECTOR) || image.closest(LINK_CARD_SELECTOR)
}

function posterSource(image){
  return String(image?.currentSrc || image?.getAttribute?.('src') || '').trim()
}

function hideBrokenPosterCard(image, reason){
  const card = posterCard(image)
  if(!card) return false
  card.setAttribute('data-poster-unavailable', reason || '1')
  card.hidden = true
  return true
}

function inspectPosterImage(image){
  const card = posterCard(image)
  if(!card || card.hidden) return

  const src = posterSource(image)
  if(!src) return

  // Прямые локальные SVG — это декоративные заглушки. Они успешно грузятся,
  // поэтому обычный обработчик error их никогда не замечал.
  if(isPlaceholderPoster(src)){
    hideBrokenPosterCard(image, 'placeholder')
    return
  }

  // complete + naturalWidth=0 означает, что запрос уже завершился ошибкой
  // до подключения глобального обработчика.
  if(image.complete && image.naturalWidth === 0){
    hideBrokenPosterCard(image, 'load-error')
  }
}

function scanPosterImages(root = document){
  if(!root?.querySelectorAll) return
  root.querySelectorAll(`${CARD_SELECTOR} img`).forEach(inspectPosterImage)
}

export default function PosterFailureGuard(){
  useEffect(() => {
    const onImageError = event => {
      const image = event.target
      if(!posterCard(image)) return
      hideBrokenPosterCard(image, 'load-error')
    }

    const onImageLoad = event => {
      const image = event.target
      if(!posterCard(image)) return
      inspectPosterImage(image)
    }

    const observer = new MutationObserver(records => {
      for(const record of records){
        if(record.type === 'attributes' && record.target?.tagName === 'IMG'){
          inspectPosterImage(record.target)
          continue
        }
        for(const node of record.addedNodes || []){
          if(node?.nodeType !== 1) continue
          if(node.tagName === 'IMG') inspectPosterImage(node)
          scanPosterImages(node)
        }
      }
    })

    window.addEventListener('error', onImageError, true)
    window.addEventListener('load', onImageLoad, true)
    observer.observe(document.documentElement, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['src','srcset']
    })

    const frame = requestAnimationFrame(() => scanPosterImages(document))

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('error', onImageError, true)
      window.removeEventListener('load', onImageLoad, true)
    }
  }, [])

  return null
}
