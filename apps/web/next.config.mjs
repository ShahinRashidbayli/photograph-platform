import path from 'node:path'

/**
 * Where /api/* is proxied. Resolved once, at build time — see the `rewrites()`
 * note below for why that distinction matters.
 *
 * A container build must say this explicitly. The localhost default is correct
 * for `npm run dev` and for CI's build job, but inside an image it points at a
 * port nothing is listening on, and the failure only shows up in a deployed
 * environment. The Dockerfile sets DOCKER_BUILD=1 so that case fails here,
 * loudly, at build time instead — the same "refuse to start half-configured"
 * rule the API applies to its R2 and email credentials.
 */
const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8080'

if (process.env.DOCKER_BUILD === '1' && !process.env.API_BASE_URL) {
  throw new Error(
    'API_BASE_URL must be set as a build argument when building the web image.\n' +
      '  docker build -f apps/web/Dockerfile --build-arg API_BASE_URL=https://api.example.com .\n' +
      'It is baked into routes-manifest.json at build time; setting it at runtime does nothing.'
  )
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit .next/standalone — a self-contained server bundle with only the
  // node_modules it actually traced. The Docker image copies that instead of
  // the whole workspace tree, which is the difference between a ~200MB image
  // and a ~1.5GB one.
  output: 'standalone',
  // This is an npm-workspaces monorepo, so file tracing has to start at the
  // repo root or Next resolves the hoisted root node_modules as "outside the
  // project" and leaves those dependencies out of the bundle — the container
  // then dies on first request with MODULE_NOT_FOUND.
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  images: {
    remotePatterns: [],
  },
  // Proxy /api/* to the Spring Boot backend so the browser sees a single origin.
  // This makes httpOnly cookies work without cross-origin CORS complexity.
  //
  // BUILD-TIME, NOT RUNTIME. `next build` calls this function and serialises
  // the result into .next/routes-manifest.json, so whatever API_BASE_URL holds
  // during the build is baked into the image for good — setting it on the
  // running container has no effect at all. Getting this wrong is invisible
  // until deploy, where every browser API call hits localhost inside its own
  // container and fails with ECONNREFUSED. Hence the guard below.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
