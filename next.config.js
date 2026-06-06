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
      { source: '/year/2026', destination: '/anime-2026', permanent: true },
      { source: '/year/2025', destination: '/anime-2025', permanent: true },
      { source: '/year/2024', destination: '/anime-2024', permanent: true },
      { source: '/year/2023', destination: '/anime-2023', permanent: true },
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
      },
      {
        source: '/aianime-logo.png',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }
        ]
      },
      {
        source: '/favicon.ico',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }
        ]
      },
      {
        source: '/site.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' }
        ]
      }

    ]
  }
}
module.exports = nextConfig
