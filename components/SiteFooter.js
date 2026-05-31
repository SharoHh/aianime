import Link from 'next/link'

const footerLinks = [
  ['Каталог', '/catalog'],
  ['Расписание', '/schedule'],
  ['Подборки', '/collections'],
  ['AI-подбор', '/ai'],
  ['Профиль', '/profile'],
]

export default function SiteFooter(){
  const year = new Date().getFullYear()

  return <footer className="site-footer site-footer-compact" data-aianime-footer="v97">
    <div className="site-footer-inner">
      <Link href="/" className="site-footer-logo" aria-label="На главную Aianime">
        <span className="site-footer-logo-mark" aria-hidden="true"><img src="/aianime-logo.png" alt="" /></span>
        <span><strong>Aianime</strong><em>аниме без лишнего шума</em></span>
      </Link>

      <nav className="site-footer-links" aria-label="Нижняя навигация">
        {footerLinks.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
      </nav>

      <p className="site-footer-note">© {year} Aianime · каталог, озвучки и расписание обновляются автоматически.</p>
    </div>
  </footer>
}
