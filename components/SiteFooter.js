import Link from 'next/link'

const primaryLinks = [
  ['Каталог', '/catalog'],
  ['Расписание', '/schedule'],
  ['Подборки', '/collections'],
  ['Топ аниме', '/top'],
]

const serviceLinks = [
  ['AI-подбор', '/ai'],
  ['Жанры', '/genres'],
  ['Сезоны', '/season'],
  ['Студии', '/studios'],
]

const accountLinks = [
  ['Профиль', '/profile'],
  ['Избранное', '/favorites'],
  ['История', '/history'],
  ['Настройки', '/settings'],
]

function FooterColumn({ title, links }){
  return <nav className="site-footer-col" aria-label={title}>
    <b>{title}</b>
    {links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
  </nav>
}

export default function SiteFooter(){
  const year = new Date().getFullYear()

  return <footer className="site-footer" data-aianime-footer="v73">
    <div className="site-footer-inner">
      <section className="site-footer-brand" aria-label="Aianime">
        <Link href="/" className="site-footer-logo" aria-label="На главную Aianime">
          <span className="site-footer-logo-mark" aria-hidden="true"><img src="/aianime-logo.png" alt="" /></span>
          <span><strong>Aianime</strong><em>аниме без лишнего шума</em></span>
        </Link>
        <p>Каталог, подборки, расписание, профиль и онлайн-просмотр в одном лёгком интерфейсе.</p>
        <div className="site-footer-badges" aria-label="Возможности сайта">
          <span>AI-подбор</span>
          <span>Русский каталог</span>
          <span>Kodik-плеер</span>
        </div>
      </section>

      <div className="site-footer-links">
        <FooterColumn title="Навигация" links={primaryLinks} />
        <FooterColumn title="Сервис" links={serviceLinks} />
        <FooterColumn title="Аккаунт" links={accountLinks} />
      </div>
    </div>

    <div className="site-footer-bottom">
      <span>© {year} Aianime</span>
      <span>Сайт развивается: каталог, озвучки и расписание могут обновляться автоматически.</span>
    </div>
  </footer>
}
