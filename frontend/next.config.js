/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_GOOGLE_CLIENT_ID: process.env.NEXT_GOOGLE_CLIENT_ID || '',
  },
  async redirects() {
    return [
      // Legacy /resume -> /guides
      { source: '/resume', destination: '/guides', permanent: true },
      { source: '/resume/:path*', destination: '/guides/:path*', permanent: true },
      // Redirect www to non-www
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.lurnia.app',
          },
        ],
        destination: 'https://lurnia.app/:path*',
        permanent: true,
      },
      // Redirect http to https
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://lurnia.app/:path*',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
          },
        ],
      },
    ]
  },
  async rewrites() {
    const backend = (process.env.NEXT_PUBLIC_API_URL || 'https://mentorai-production.up.railway.app')
      .trim()
      .replace(/\/$/, '')
    const backendOrigin = backend.replace(/\/api$/i, '')
    return {
      afterFiles: [
        {
          source: '/api/:path*',
          destination: `${backendOrigin}/api/:path*`
        }
      ]
    }
  },
}

module.exports = nextConfig

