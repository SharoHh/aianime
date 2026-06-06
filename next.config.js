/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  turbopack: { root: __dirname },
  async redirects(){
    return [
      { source: '/collection', destination: '/collections', permanent: true },
      { source: '/collections-old', destination: '/collections', permanent: true },
      { source: '/podborki', destination: '/collections', permanent: true },
      { source: '/podbor', destination: '/ai', permanent: true },
      { source: '/ai-podbor', destination: '/ai', permanent: true },
      { source: '/ai-podborki', destination: '/ai', permanent: true },
      { source: '/recommend', destination: '/ai', permanent: true },
      { source: '/recommendations', destination: '/ai', permanent: true },
      { source: '/anime/catalog-title-:id', destination: '/catalog', permanent: true },
      { source: '/year/:year(\\d{4})', destination: '/anime-:year', permanent: true },
    ]
  },
  async headers(){
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ]
      },
      {
        source: '/posters/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }
        ]
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }
        ]
      }
    ]
  }
}
module.exports = nextConfig
