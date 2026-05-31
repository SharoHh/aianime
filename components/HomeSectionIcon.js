// AIanime v137: clean SVG section icons reused across the site.
export default function HomeSectionIcon({ type = 'spark' }){
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': 'true'
  }

  return <span className={`home-section-icon home-section-icon-${type}`} aria-hidden="true">
    {type === 'popular' ? <svg {...common}>
      <path d="M5 16.5c0-2.2 1.4-3.7 3.1-4.9 1.2-.9 2.3-2.1 2.3-4.1 0-.8-.1-1.5-.3-2.1 3.3 1.4 5.4 4 5.4 7.2 0 .7-.1 1.3-.3 1.9.8-.6 1.4-1.5 1.7-2.7 1.2 1.1 2.1 2.7 2.1 4.7 0 3.2-2.6 5.5-7 5.5s-7-2.3-7-5.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M10 18.2c0-1.1.7-1.9 1.5-2.6.7-.6 1.2-1.2 1.2-2.2 1.3.8 2.2 2 2.2 3.6 0 1.7-1.4 3-3 3-1.1 0-1.9-.6-1.9-1.8Z" fill="currentColor"/>
    </svg> : null}

    {type === 'new' ? <svg {...common}>
      <path d="M12 3.5l1.55 4.95L18.5 10l-4.95 1.55L12 16.5l-1.55-4.95L5.5 10l4.95-1.55L12 3.5Z" fill="currentColor"/>
      <path d="M18.5 14.5l.75 2.25 2.25.75-2.25.75-.75 2.25-.75-2.25-2.25-.75 2.25-.75.75-2.25Z" fill="currentColor" opacity=".72"/>
      <path d="M5.5 3.8l.55 1.65 1.65.55-1.65.55L5.5 8.2l-.55-1.65L3.3 6l1.65-.55L5.5 3.8Z" fill="currentColor" opacity=".55"/>
    </svg> : null}

    {type === 'continue' ? <svg {...common}>
      <path d="M8 6.8c0-.9 1-1.4 1.8-.9l7.4 4.6c.7.4.7 1.5 0 1.9L9.8 17c-.8.5-1.8-.1-1.8-.9V6.8Z" fill="currentColor"/>
      <path d="M5 6v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".45"/>
    </svg> : null}


    {type === 'top' ? <svg {...common}>
      <path d="M5 18h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".45"/>
      <path d="M7 15.5V9.8c0-.7.6-1.3 1.3-1.3h1.2c.7 0 1.3.6 1.3 1.3v5.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M13.2 15.5V6.3c0-.7.6-1.3 1.3-1.3h1.2c.7 0 1.3.6 1.3 1.3v9.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M4.8 9.5l1.1 1.1 2.3-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".72"/>
    </svg> : null}

    {type === 'schedule' ? <svg {...common}>
      <path d="M6.8 4.8h10.4A2.2 2.2 0 0 1 19.4 7v10a2.2 2.2 0 0 1-2.2 2.2H6.8A2.2 2.2 0 0 1 4.6 17V7a2.2 2.2 0 0 1 2.2-2.2Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 3.5v3M16 3.5v3M5 9h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8.4 12.2h2.3M13.3 12.2h2.3M8.4 15.5h2.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".55"/>
    </svg> : null}

    {type === 'ai' ? <svg {...common}>
      <path d="M12 4.2l1.25 4.05L17.3 9.5l-4.05 1.25L12 14.8l-1.25-4.05L6.7 9.5l4.05-1.25L12 4.2Z" fill="currentColor"/>
      <path d="M18 14.2l.65 1.95 1.95.65-1.95.65L18 19.4l-.65-1.95-1.95-.65 1.95-.65L18 14.2Z" fill="currentColor" opacity=".65"/>
      <path d="M6 14.7l.5 1.5 1.5.5-1.5.5L6 18.7l-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" fill="currentColor" opacity=".45"/>
    </svg> : null}

    {type === 'collections' ? <svg {...common}>
      <path d="M7 5.8h10a1.8 1.8 0 0 1 1.8 1.8v8.8a1.8 1.8 0 0 1-1.8 1.8H7a1.8 1.8 0 0 1-1.8-1.8V7.6A1.8 1.8 0 0 1 7 5.8Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M8.5 10h7M8.5 13h4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8.8 3.8h6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".45"/>
    </svg> : null}
  </span>
}
