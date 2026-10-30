# photograph-platform

A multi-tenant SaaS platform for professional photographers — portfolio, bookings, client galleries and leads, all in one place.

## Repository structure

```
photograph-platform/
├── apps/
│   ├── api/          Spring Boot 3 REST API (Java 21)
│   └── web/          Next.js 15 frontend (TypeScript + Bootstrap 5)
├── packages/
│   └── shared/       Shared TypeScript types and utilities
├── docs/             Architecture decisions, ERD, API contracts
├── infra/            Docker Compose, environment templates
└── .github/
    └── workflows/    GitHub Actions CI pipeline
```

## Tech stack

| Layer       | Technology                                          |
|-------------|-----------------------------------------------------|
| Backend     | Spring Boot 3.4, Java 21, Spring Security, JPA      |
| Auth        | JWT (HS256) + httpOnly cookies, refresh token rotation |
| Multi-tenant| Schema-per-tenant (PostgreSQL), Flyway migrations   |
| Rate limit  | Redis (login brute-force protection)                |
| Media       | Cloudflare R2 (S3 API) — MinIO locally, presigned uploads |
| Email       | SendGrid / Resend / SMTP — Mailpit locally           |
| Frontend    | Next.js 15, React 19, TypeScript, Bootstrap 5       |
| State       | Zustand                                             |
| Database    | PostgreSQL 16 (Testcontainers for integration tests)|
| CI/CD       | GitHub Actions                                      |
| Hosting     | Railway                                             |

---

## Local development

### Prerequisites

| Tool        | Version   | Install                                      |
|-------------|-----------|----------------------------------------------|
| Java        | 21 (LTS)  | [Corretto](https://aws.amazon.com/corretto/) |
| Maven       | 3.9+      | `brew install maven`                         |
| Node.js     | 20+       | `brew install node`                          |
| Docker      | any       | [Docker Desktop](https://www.docker.com/)    |

> **macOS note:** After installing Maven via Homebrew, add it to your PATH permanently:
> ```bash
> echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
> ```

### 1. Configure environment

```bash
cp infra/.env.example infra/.env
# Edit infra/.env — fill in DB_PASSWORD and generate a JWT_SECRET:
#   openssl rand -base64 64
```

### 2. Start infrastructure

```bash
make infra          # PostgreSQL (5433), Redis (6379), MinIO (9000/9001), Mailpit (8025)
```

MinIO is the local stand-in for Cloudflare R2 and holds every uploaded image.
`make infra` also creates the `fotolio-media-dev` bucket, so portfolio uploads
and gallery delivery work straight away — no Cloudflare account needed. See
[infra/README.md](infra/README.md#object-storage-r2--minio) for production R2
setup.

### 3. Start the API

```bash
make api            # loads infra/.env, kills any old process on :8080, starts Spring Boot
```

### 4. Start the frontend

```bash
make web            # starts Next.js dev server on http://localhost:3000
```

Open **http://localhost:3000** — the middleware redirects to `/login` automatically.

---

## Makefile targets

Run all commands from the **project root**.

| Target       | What it does                                                   |
|--------------|----------------------------------------------------------------|
| `make infra` | `docker compose up -d postgres redis minio` + creates the media bucket |
| `make api`   | Kill :8080 → load `infra/.env` → `mvn spring-boot:run`        |
| `make web`   | `npm run dev` in `apps/web`                                    |
| `make dev`   | `infra` + `api` (background) + `web` (foreground)              |
| `make stop`  | Kill dev servers on :8080 and :3000                            |
| `make test`  | Run all Java + Jest tests                                      |
| `make migrate` | Run Flyway migrations manually                               |
| `make clean` | Stop Docker volumes + clean build artefacts                    |

> `make api` uses the absolute path `/opt/homebrew/bin/mvn` so it works regardless of shell PATH — no more `command not found: mvn`.

---

## Architecture — Sprint 1 (Auth + Multi-Tenant)

### Multi-tenancy

Every tenant gets its own PostgreSQL schema (`tenant_<uuid>`). Flyway runs per-tenant migrations automatically on registration. The `public` schema holds only `tenants` and `users`.

```
public.tenants        ← subdomain, plan, schema_name (generated column)
public.users          ← tenant_id FK, email, password_hash, role
public.refresh_tokens ← token_hash (SHA-256), expiry, used flag

tenant_<uuid>.photos
tenant_<uuid>.categories
tenant_<uuid>.clients
tenant_<uuid>.galleries
tenant_<uuid>.leads
tenant_<uuid>.bookings
```

### Auth flow

```
POST /api/auth/register   → creates tenant + schema + user → sets httpOnly cookies
POST /api/auth/login      → validates credentials, rate-limited (Redis) → sets httpOnly cookies
GET  /api/auth/me         → returns user + tenant profile (requires valid JWT cookie)
POST /api/auth/refresh    → rotates refresh token → sets new httpOnly cookies
POST /api/auth/logout     → invalidates all refresh tokens for user → clears cookies
```

- Access token: 24 h · Refresh token: 30 days
- Tokens stored as **httpOnly; SameSite=Lax** cookies — not accessible via JavaScript
- Next.js proxies all `/api/*` requests to Spring Boot (same-origin, no CORS in browser)
- Refresh token rotation: reuse of a consumed token invalidates **all** sessions for that user

---

## API endpoints

| Method | Path                                    | Auth | Description                              |
|--------|-----------------------------------------|------|------------------------------------------|
| POST   | `/api/auth/register`                    | —    | Register new tenant                      |
| POST   | `/api/auth/login`                       | —    | Login                                    |
| GET    | `/api/auth/me`                          | ✓    | Current user profile                     |
| POST   | `/api/auth/refresh`                     | —    | Rotate refresh token                     |
| POST   | `/api/auth/logout`                      | ✓    | Invalidate all sessions                  |
| POST   | `/api/auth/verify-email`                | —    | Verify email via one-time token          |
| POST   | `/api/auth/resend-verification`         | ✓    | Re-send the verification email           |
| GET    | `/api/public/portfolio/{subdomain}`     | —    | Public portfolio (consumed by `/p/...`) |
| GET    | `/api/portfolio/photos`                 | ✓    | List own portfolio photos                |
| POST   | `/api/portfolio/photos/{id}/publish`    | ✓    | Publish a photo                          |
| DELETE | `/api/portfolio/photos/{id}`            | ✓    | Delete a photo                           |
| POST   | `/api/public/leads/{subdomain}`         | —    | Public lead capture (honeypot + ratelimit) |
| GET    | `/api/leads`                            | ✓    | List leads (filter by score/status)      |
| GET    | `/api/photographerBookings`             | ✓    | List bookings for the current studio     |
| GET    | `/api/customerBookings`                 | ✓    | List bookings for a given client         |
| PATCH  | `/api/bookings/{id}/status`             | ✓    | Transition booking status (409 on illegal) |

Not yet implemented (see master spec): Stripe payments, gallery delivery,
client CRM endpoints, package CRUD, magic-link auth, Instagram webhook,
contracts, calendar sync.

---

## Branch strategy

| Branch       | Purpose                             |
|--------------|-------------------------------------|
| `main`       | Production — protected, auto-deploy |
| `develop`    | Integration branch for features     |
| `feature/*`  | Feature development                 |
| `hotfix/*`   | Urgent production fixes             |

## Commit convention

Follows [Conventional Commits](https://www.conventionalcommits.org/):
`feat` · `fix` · `chore` · `docs` · `test` · `refactor`

## CI pipeline

Every pull request to `develop` and every push to `main` runs:
1. `test-api` — JUnit + Testcontainers integration tests (real PostgreSQL)
2. `test-web` — Jest tests
3. `lint` — Checkstyle (Java) + ESLint (TypeScript)
4. `build` — Maven package + Next.js build (runs only when all checks pass)
