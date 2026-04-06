/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
  },
  // Proxy /api/* to the Spring Boot backend so the browser sees a single origin.
  // This makes httpOnly cookies work without cross-origin CORS complexity.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_BASE_URL ?? 'http://localhost:8080'}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
