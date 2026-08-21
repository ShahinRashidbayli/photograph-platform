# infra

Infrastructure configuration for local development and production deployment.

## Structure

```
infra/
├── docker-compose.yml        Local dev stack (PostgreSQL, Redis, MinIO, Mailpit)
├── postgres-init/            Bootstrap SQL run on first container start
└── .env.example              Template — copy to infra/.env and fill in
```

Deployment lives with each service rather than here, so the build context and
its config stay next to the code they build:

```
apps/api/Dockerfile           Multi-stage build → executable jar on a JRE
apps/api/docker-entrypoint.sh Two modes: `serve` and `migrate`
apps/api/railway.json         Railway service config (API)
apps/web/Dockerfile           Multi-stage build → Next.js standalone server
apps/web/railway.json         Railway service config (web)
```

## Local development

Spin up a local PostgreSQL instance:

```bash
docker compose up -d
```

Then start the API with the `prod` profile pointing at the local container:

```bash
export DB_URL=jdbc:postgresql://localhost:5433/centralidp
export DB_USERNAME=fotolio_app
export DB_PASSWORD=fotolio_app_dev_password
cd apps/api && mvn spring-boot:run
```

### The `fotolio_app` role (tenant isolation)

The app runs every query as `fotolio_app`, a role with no table ownership and
no `BYPASSRLS` — Postgres Row-Level Security (`V11__tenant_rls.sql`) is what
actually keeps one tenant's data from being visible to another's queries, and
RLS only applies to a role like this. Never point `DB_USERNAME` at the
owning/migration role.

- **Local Docker Compose**: `fotolio_app` is created automatically by
  `infra/postgres-init/01-create-app-role.sql` the first time the `postgres`
  container initializes its data volume. If you already have an existing
  local volume from before this role existed, either recreate the volume
  (`docker compose down -v && docker compose up -d`) or run the same SQL file
  manually against the running container.
- **Supabase**: after the first `mvn flyway:migrate` run against a fresh
  project (which creates the role via `V11__tenant_rls.sql`, with no
  password), set its password once via the Supabase SQL editor:
  ```sql
  ALTER ROLE fotolio_app PASSWORD '<a-strong-generated-password>';
  ```
  then put that value in `DB_PASSWORD`.

## Object storage (R2 / MinIO)

Every uploaded image — portfolio photos, client-gallery deliveries, avatars —
lives in an S3-compatible bucket. The API never proxies image bytes: it hands
the browser a **presigned URL** and the browser talks to the bucket directly.

### Local

`make infra` starts a MinIO container and creates the bucket, so uploads work
on a fresh checkout with no Cloudflare account:

| | |
|---|---|
| S3 API | `http://localhost:9000` |
| Console | `http://localhost:9001` (`fotolio_dev` / `fotolio_dev_secret`) |
| Bucket | `fotolio-media-dev` |

The matching `R2_*` values are already in `infra/.env.example`.

### Production (Cloudflare R2)

1. Create a bucket (e.g. `fotolio-media`) and an **R2 API token** with
   *Object Read & Write*.
2. Set the variables:

   ```
   R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   R2_ACCESS_KEY=<token access key id>
   R2_SECRET_KEY=<token secret>
   R2_BUCKET=fotolio-media
   ```

   Leave `R2_PATH_STYLE` unset — R2 serves virtual-host style. It is `true`
   only for MinIO, whose `bucket.localhost` form does not resolve. A mismatch
   signs presigned URLs for the wrong host and every upload fails with an
   opaque `403 SignatureDoesNotMatch`; `R2StorageServiceIT` covers this.

3. Add a **CORS policy** on the bucket, or the browser's direct upload is
   blocked before it starts:

   ```json
   [
     {
       "AllowedOrigins": ["https://app.fotolio.de"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedHeaders": ["content-type"],
       "ExposeHeaders": ["etag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

**Misconfiguration behaviour is deliberate** (`R2Config`): all-placeholder
values mean "not configured" — the API boots, warns once, and image URLs come
back `null`. A *real* endpoint with placeholder keys refuses to start, rather
than booting healthy and failing at the first upload.

## Environment variables

Copy the template and fill in real values — never commit `.env`:

```bash
cp infra/.env.example infra/.env
```

`infra/.env.example` is the authoritative list; every variable is documented
inline there. The ones with no safe default:

| Variable                       | Description                                        |
|--------------------------------|----------------------------------------------------|
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | Runtime connection, as `fotolio_app`     |
| `FLYWAY_URL` / `FLYWAY_USER`   | Migration connection, as the **owning** role       |
| `JWT_SECRET`                   | ≥32 bytes — `openssl rand -base64 64`              |
| `EMAIL_PROVIDER` + provider key| `sendgrid` \| `resend` \| `none` (boot fails if a provider is named without its key) |
| `R2_ENDPOINT` / `R2_ACCESS_KEY` / `R2_SECRET_KEY` / `R2_BUCKET` | Object storage      |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Optional — omit to run manual-transfer only |
| `API_BASE_URL`                 | Web → API proxy target (server-side only)          |

All secrets are stored in **GitHub Secrets** for CI and in **Railway Variables** for production.

## Deployment

Both services ship as Docker images built from the **repository root** as
context (npm workspaces hoist `node_modules` and the lockfile to the root, so
`apps/web` alone is not a buildable context):

```bash
docker build -f apps/api/Dockerfile -t fotolio-api .
docker build -f apps/web/Dockerfile --build-arg API_BASE_URL=https://api.fotolio.de -t fotolio-web .
```

### `API_BASE_URL` is a *build* argument for the web image

Next resolves `next.config.mjs`'s `rewrites()` during `next build` and freezes
the `/api/*` destination into `routes-manifest.json`. Setting `API_BASE_URL` on
the **running** container does nothing — the image would proxy every browser
API call to `localhost` inside its own container and fail with
`ECONNREFUSED`, with nothing in the logs pointing at the cause.

So it must be passed at build time, and the build **fails** without it rather
than baking in the localhost default. On Railway, set `API_BASE_URL` as a
service variable: Dockerfile builds receive service variables as build args.
Point it at the API service's private URL.

CI builds both on every PR and smoke-tests them, so a Dockerfile break is
caught before a deploy rather than by one.

### Migrations are a separate step

The API image has two modes, and the split is not cosmetic — they connect as
**different database roles**:

```bash
docker run --rm --env-file infra/.env fotolio-api migrate   # owning role, then exits
docker run -d   --env-file infra/.env fotolio-api           # fotolio_app, serves
```

`serve` cannot migrate: it runs as `fotolio_app`, which owns nothing and has no
DDL rights (that is exactly what makes RLS bind to it). So `spring.flyway.enabled`
is false in the app and `migrate` flips it on for a one-shot run using
`FLYWAY_URL` / `FLYWAY_USER` / `FLYWAY_PASSWORD`. Running `migrate` with
`DB_USERNAME` will fail on permissions, by design.

**Always run `migrate` before rolling out a new `serve`.** On Railway this is
wired as `preDeployCommand` in `apps/api/railway.json`, so it happens
automatically on each deploy and a failed migration aborts the rollout.

### Railway

Create two services from this repo, each with its **root directory set to the
repository root** and its config path pointed at the service's `railway.json`
(`apps/api/railway.json`, `apps/web/railway.json`). Then set variables:

- **API** — everything in the table above, plus `COOKIE_SECURE=true`,
  `COOKIE_DOMAIN=.yourdomain.de`, `CORS_ALLOWED_ORIGINS=https://app.yourdomain.de`.
- **Web** — `API_BASE_URL` pointing at the API service's private URL, and
  `APEX_HOST=yourdomain.de` so tenant subdomains resolve.

Health checks are already declared: `/actuator/health` for the API and `/login`
for the web service.
