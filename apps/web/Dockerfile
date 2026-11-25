# syntax=docker/dockerfile:1
#
# Build context is the REPOSITORY ROOT — npm workspaces hoist node_modules to
# the root and the lockfile lives there, so the build cannot see them from
# apps/web alone:
#   docker build -f apps/web/Dockerfile -t fotolio-web .
#
# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — install workspace dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /repo

# Manifests only, so the (slow) install layer is cached until a dependency
# actually changes. patches/ belongs with them: `npm ci` applies it
# (postinstall), and without it next's Google Fonts loader is unpatched.
COPY package.json package-lock.json ./
COPY patches ./patches
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — build
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /repo

# Where the running container reaches the API. This is a BUILD argument, not a
# runtime variable, and it cannot be otherwise: Next resolves next.config's
# rewrites() during `next build` and freezes the destination into
# routes-manifest.json. Passing it to `docker run` instead has no effect, and
# the image would silently proxy /api/* to localhost inside its own container.
#
# DOCKER_BUILD=1 makes next.config fail the build when it is missing, rather
# than quietly baking in the localhost default.
#   docker build -f apps/web/Dockerfile --build-arg API_BASE_URL=https://api.example.com .
ARG API_BASE_URL
ENV API_BASE_URL=$API_BASE_URL
ENV DOCKER_BUILD=1

COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/web ./apps/web

# packages/shared ships compiled JS (its dist/ is gitignored), so it has to be
# built before the web app that depends on it.
RUN npm run build --workspace=packages/shared --if-present
RUN npm run build --workspace=apps/web

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S fotolio && adduser -S -G fotolio fotolio

# The standalone bundle mirrors the workspace layout, so the server entrypoint
# is at apps/web/server.js and static assets have to be restored around it —
# Next deliberately leaves .next/static and public/ out of the traced bundle.
COPY --from=build --chown=fotolio:fotolio /repo/apps/web/.next/standalone ./
COPY --from=build --chown=fotolio:fotolio /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=fotolio:fotolio /repo/apps/web/public ./apps/web/public

USER fotolio

# Railway and most platforms inject PORT; default to 3000 for a plain
# `docker run`. HOSTNAME must be 0.0.0.0 or the standalone server binds to
# localhost inside the container and every external request is refused.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
