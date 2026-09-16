import path from 'node:path';

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
const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8080';

if (process.env.DOCKER_BUILD === '1' && !process.env.API_BASE_URL) {
  throw new Error(
    'API_BASE_URL must be set as a build argument when building the web image.\n' +
      '  docker build -f apps/web/Dockerfile --build-arg API_BASE_URL=https://api.example.com .\n' +
      'It is baked into routes-manifest.json at build time; setting it at runtime does nothing.'
  );
}

/**
 * Security headers for every page this server renders.
 *
 * The API sets Spring Security's defaults, but the API answers JSON. The pages
 * a browser actually loads — the dashboard with its invoices, client PII and
 * payment screens, and the public gallery viewer — come from here, and they
 * were served with no security headers at all. Nothing stopped the dashboard
 * being framed, and an XSS anywhere had the whole origin to work with.
 *
 * CSP is deliberately absent from this list. It has to be built against what
 * the app really loads (Stripe.js, the inline theme bootstrap in layout.tsx,
 * the presigned R2 image hosts) and shipped in Report-Only first, or it breaks
 * checkout in production. The headers below need no such measurement, so they
 * are not held up waiting for it.
 */
const securityHeaders = [
  // Clickjacking. frame-ancestors is the modern spelling and the one that
  // takes effect where both are understood; X-Frame-Options stays for older
  // browsers, which ignore the former entirely.
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stops a response being reinterpreted as a script or stylesheet because it
  // looked like one — relevant here because uploads are served through this
  // origin's rewrite.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Gallery and invoice URLs carry capability tokens and ids in the path.
  // Sending those in the Referer to any third party the page links to would
  // hand out access; same-origin navigations keep the full URL.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing here uses these, and saying so means a future dependency cannot
  // start using them quietly.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // HTTPS-only for two years, subdomains included — every tenant is one.
  // Ignored by browsers over plain HTTP, so it is inert in local development
  // rather than needing to be conditional.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Build output directory, overridable per invocation.
   *
   * <p>`next dev` and `next build` both own `.next`, and they write
   * incompatible things into it: a production build leaves a chunk manifest the
   * dev server then tries to load, which fails as `Cannot find module
   * './383.js'` on a route that was never touched. Running a verification build
   * while a dev server is up therefore breaks the dev server, and the error
   * points at the wrong thing entirely.
   *
   * <p>So a checking build goes somewhere else:
   *
   *   NEXT_DIST_DIR=.next-verify npx next build
   *
   * Unset — every normal `dev`, `build` and `start` — it is `.next` as before.
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Announcing the framework and its version only helps someone matching a
  // CVE list against this deployment.
  poweredByHeader: false,

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },

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
    /**
     * Turns off the image optimizer, which removes the /_next/image route
     * entirely — verified: it answers 404 rather than optimizing.
     *
     * Nothing here uses next/image (zero imports), so the route served no
     * feature. What it did serve was sharp, which decodes whatever bytes it is
     * given: the libvips and libheif advisories against it are all triggered by
     * processing a crafted image. Today's exposure was small — `remotePatterns`
     * is empty so remote URLs are refused, and the only local files are two
     * committed brand images — but the route fetches same-origin paths through
     * the /api/* rewrite as well, so the day a gallery photo is proxied through
     * this origin, or a remote pattern is added for R2, it becomes a decoder
     * for bytes a stranger uploaded.
     *
     * sharp itself still ships in the bundle; removing the library is a
     * different job. This removes the way in.
     */
    unoptimized: true,
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
    ];
  },
};

export default nextConfig;
