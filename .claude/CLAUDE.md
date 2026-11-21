# Fotolio — photograph-platform

Multi-tenant SaaS for photographers (German market, GDPR-bound). One studio = one
tenant; its clients log in as CUSTOMER. Plans: STARTER / PRO / STUDIO.

This file is a map, not documentation. **Use it to go straight to the right
file instead of scanning the repo.** Layer-specific rules live in
`.claude/rules/api.md` and `.claude/rules/web.md` (path-scoped: loaded only when
working under `apps/api` / `apps/web`).

## Layout

| Path | What |
|---|---|
| `apps/api` | Spring Boot modular monolith. `src/main/java/com/photographplatform/api/<module>/` |
| `apps/web` | Next.js 15 App Router, React 19, TanStack Query, Zustand |
| `packages/shared` | Small shared TS package (`@photograph-platform/shared`) |
| `infra/docker-compose.yml` | Postgres (:5433, db `centralidp`), Redis, MinIO, Mailpit |
| `scripts/` | `seed-demo.sql`, `e2e-stack.sh`, `audit-gate.sh` |
| `.github/workflows/ci.yml` | What must pass: format, lint, typecheck, i18n, `mvn verify`, jest, audit, build |

Backend module ↔ frontend surface (same name on both sides):
`auth tenant booking client lead inquiry gallery portfolio invoice payment billing
contract pricing resource analytics privacy roadmap branding entitlement notification audit`
→ BE `api/<module>/`, FE `apps/web/src/app/(dashboard)/<surface>/`, hook `src/hooks/use<Surface>.ts`,
strings `src/lib/i18n/locales/{en,de}/<surface>.ts`.

## Which docs to trust

Authoritative (decisions, intent, order of work):
- `docs/ROADMAP.md` — **read before any new feature**
- `docs/DEVELOPMENT_PLAN.md` — build order (may lag behind the code; check the code)
- `docs/BACKEND_FOUNDATION.md` — architecture standard for new backend modules
- `docs/PRICING.md`, `docs/VISION_AND_EXTENSIBILITY.md`, `docs/adr/*.md`
- `GLOSSARY.md` — domain terms; name things in code and UI copy after them

**Stale — do not rely on them**: root `ENDPOINT_MAP.md`, `ENDPOINTS_AND_TESTING.md`,
`TESTING_UI_PAGES.md`, `SPRINT_2_COMPLETION.md`, `REGISTER_DESIGN_IMPROVEMENTS.md`, and
`docs/{PLATFORM_DOCUMENTATION,USER_WORKFLOWS,DEVELOPER_QUICK_REFERENCE,AVAILABLE_APIS,AUTH_*,UI_TESTING_GUIDE}.md`.
The code is the source of truth: endpoints are in `*Controller.java`, module
boundaries in `ArchitectureTest.java`. Do not write new descriptive docs.

## Commands

```
make infra          # docker services
make api / make web # run BE (:8080) / FE (:3000)
make migrate        # Flyway — NOT run on app start
make seed           # demo data for tenant `shahinrashidbayli`
make plan PLAN=STUDIO   # switch local tenant plan (local tenant defaults to STARTER!)
make e2e-stack      # isolated stack on :3001/:8081 for Playwright
```
- Never run `npm run build` in `apps/web` while `next dev` is running — it breaks :3000.
  Use `npm run typecheck` instead.
- `gh`: run `gh auth switch --user ShahinRashidbayli` first.

## Consistency rule (most important)

Before writing a new feature or changing one, **find the closest existing sibling
and copy its shape** — file layout, naming, error handling, tests, i18n. Don't
invent a second way of doing something the repo already does. If the existing
pattern looks wrong, say so and ask; don't silently diverge.

Reference implementations to copy:

| Building… | Copy from |
|---|---|
| New BE module (new standard) | `privacy/` (`api/` + `application/`) + `docs/BACKEND_FOUNDATION.md` |
| Controller + service + DTO (classic) | `client/` (smallest complete module) |
| Plan-gated feature | `contract/` (BE `requireCapability…`) + FE `useEntitlements` / `PlanUpgradeDialog` |
| Side effect after a write | `lead/event/LeadCreatedEvent` → `notification/service/LeadNotificationService` |
| Stores personal data | implement `PersonalDataEraser` like `client/service/ClientEraser` |
| Per-tenant scheduled job | `gallery/service/GalleryRetentionJob` + `common/scheduling/TenantJobRunner` |
| New table | latest migration + `V36__grant_and_secure_…sql` (GRANT + RLS) |
| FE data hook | `src/hooks/useInvoices.ts` (exported query-key factories) |
| FE page | `(dashboard)/clients/` (`page.tsx` + `*.styles.ts`) |
| Settings subpage | `(dashboard)/settings/privacy/` + `settings-nav.ts` |
| FE component test with API | `settings/PersonalDataErasure.msw.test.tsx` |

## Definition of done

1. Same pattern as the sibling feature (above).
2. BE: `mvn verify` green (checkstyle, SpotBugs, coverage floor, ArchUnit, `*IT` need Docker).
3. FE: `npm run typecheck && npm run lint && npm test && npm run i18n:check` in `apps/web`.
4. Every user-visible string exists in **both** `en` and `de`.
5. Commits: Conventional Commits (`feat(api): …`, `fix(web): …`) — enforced by `pr-title.yml`.

## Conventions

- Code, comments, commits: English. UI: German + English.
- Comments explain *why* (constraints, past bugs), not what. Match the existing density.
- Branch off `main` (`feat/…`, `fix/…`); never commit to `main` directly.
