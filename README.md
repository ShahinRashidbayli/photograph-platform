# photograph-platform

A full-stack platform for sharing and managing photographs, built as a monorepo.

## Repository structure

```
photograph-platform/
├── apps/
│   ├── api/          Spring Boot 3 REST API (Java 21)
│   └── web/          Next.js 14 frontend (TypeScript)
├── packages/
│   └── shared/       Shared TypeScript types and utilities
├── docs/             Architecture decisions, ERD, API contracts
├── infra/            Docker Compose, Railway config, environment templates
└── .github/
    └── workflows/    GitHub Actions CI pipeline
```

## Tech stack

| Layer     | Technology                     |
|-----------|--------------------------------|
| Backend   | Spring Boot 3, Java 21, JPA    |
| Frontend  | Next.js 14, React 18, TypeScript |
| Database  | PostgreSQL (H2 for tests)      |
| CI/CD     | GitHub Actions                 |
| Hosting   | Railway                        |

## Getting started

### Prerequisites
- Java 21
- Node.js 20+
- Docker (for local PostgreSQL)

### Run the API
```bash
cd apps/api
mvn spring-boot:run
```

### Run the web app
```bash
cd apps/web
npm install
npm run dev
```

## Branch strategy

| Branch       | Purpose                           |
|--------------|-----------------------------------|
| `main`       | Production — protected, auto-deploy |
| `develop`    | Integration branch for features   |
| `feature/*`  | Feature development               |
| `hotfix/*`   | Urgent production fixes           |

## Commit convention

Follows [Conventional Commits](https://www.conventionalcommits.org/):
`feat` / `fix` / `chore` / `docs` / `test` / `refactor`

## CI pipeline

Every pull request to `develop` and every push to `main` runs:
1. `test-api` — JUnit tests (H2 in-memory, no secrets needed)
2. `test-web` — Jest tests
3. `lint` — Checkstyle (Java) + ESLint (TypeScript)
4. `build` — Maven package + Next.js build (runs only when all checks pass)
