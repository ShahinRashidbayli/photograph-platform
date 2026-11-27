---
paths:
  - "apps/api/**"
---

# apps/api — Spring Boot

Root: `src/main/java/com/photographplatform/api/`. Java version pinned in `/.java-version`
(the Makefile sets `JAVA_HOME` from it; maven enforcer rejects others).

## Module shape

Classic modules: `controller/ domain/ dto/ repository/ service/` (+ optional `config/ event/`).
New modules follow `docs/BACKEND_FOUNDATION.md` (`api/` + `application/` …) — see `privacy/`.
Don't restructure the existing modules.

`ArchitectureTest` enforces boundaries with a frozen baseline (`archunit_store/`).
It is a ratchet: violations may go down, never up. Never reach into another
module's repository — call its service, or publish an event.

## Where things are (`common/`)

| Need | Use |
|---|---|
| Current tenant / user | `common/config/TenantContext`, `common/security/SecurityUtils` |
| Errors | throw `NotFoundException`, `ConflictException`, `PlanUpgradeRequiredException`… (`common/exception`); mapped by `GlobalExceptionHandler`, codes in `ErrorCode` |
| Plan gate | `EntitlementService.requireCapabilityForCurrentTenant(Capability.X)` → 402. Tiers/capabilities in `application.yml` `app.plans.tiers` |
| Read-only tenant (lapsed sub) | `requireWritableCurrentTenant()`; `@AllowedWhenReadOnly` for exceptions |
| Verified email required | `@RequiresVerifiedEmail` |
| Client IP / rate limit | `ClientIp.from(request)`, `RateLimiter` |
| Audit trail | `AuditService.log / logChange` |
| Paging / query caps | `common/util/Paging`, `common/repository/QueryLimits` |
| Dates in business zone | `common/util/BusinessZone`; inject `Clock` (`ClockConfig`), never `now()` directly |
| Image uploads | `common/media/*` (`BoundedImageDecoder`, `UploadLimits`) |
| Scheduled jobs | `TenantJobRunner` + `JobLock` |
| GDPR erasure | implement `common/privacy/PersonalDataEraser`; it is picked up automatically |
| Log fields / context | `common/logging` (`LogFields`, `MdcScope`, `RequestRoute`); rules under "Logging" below |

## Logging

Deployed, every line is one JSON object (Spring Boot `logstash` format, switched on in
`Dockerfile`); locally and in tests it is plain text. Railway filters on top-level fields:
`@request_id:…`, `@tenant_id:…`, `@level:error`, `@status:500`, `@duration_ms:>=1000`.

- **No personal data, no secrets.** Ids (UUIDs) only. Never an email, name, phone, IP address,
  token, request/response body, tenant subdomain (usually the photographer's name) or raw
  URI — `/public/galleries/{subdomain}/{token}` carries the gallery's access token; name a
  request with `RequestRoute.of(request)`. Postgres and provider exception messages embed
  values (`Key (email)=(…) already exists`): see `GlobalExceptionHandler.handleDataIntegrity`.
  Who-did-what belongs in the audit trail, not the log.
- **Levels.** ERROR: a human has to look (unexpected exception, retries exhausted, inconsistent
  data) — alerting will hang off it, so never for an expected outcome. WARN: degraded but
  handled. INFO: a state change worth finding later. DEBUG: off in production. Log a failure
  once, where it is handled.
- **Context is in the MDC, not the message.** Per request: `request_id`, `tenant_id`, `user_id`
  (`RequestLoggingFilter`, `TenantContextFilter`). Per tenant in `TenantJobRunner`: `job`,
  `tenant_id`. Per outbox job: `outbox_job_id`, `outbox_kind`, `tenant_id`. New background
  work opens its own with `MdcScope`.
- **An event's own ids go in fields**: `LOG.atInfo().addKeyValue(LogFields.X, id).log("…")`,
  names in `LogFields` (`snake_case`). Keep the message readable without them — plain-text
  output does not print fields.
- Every request already gets one access line (method, route, status, duration); don't add
  per-endpoint "called"/"returned" lines.

## Database

- Multi-tenancy is **Row-Level Security**, not schema-per-tenant: every tenant table
  has `tenant_id`, and `TenantRoutingDataSource` sets `app.tenant_id` per transaction.
- Migrations: `src/main/resources/db/migration/V<next>__snake_case.sql`. Check the
  highest number first. Never edit an applied migration — add a new one.
- **Every new table must** `GRANT … TO fotolio_app`, `ENABLE ROW LEVEL SECURITY` and
  get a tenant policy, in the same migration. Template: `V36__grant_and_secure_contracts_and_interest.sql`
  (V34/V35 forgot this and broke at runtime, not in tests).
- Migrations run only via `make migrate`, not at app start.

## Tests (`src/test/java/.../<module>/`)

| Suffix | What | Copy |
|---|---|---|
| `*Test` | unit, Mockito | `booking/BookingCommandServiceTest` |
| `*SecurityRuleTest` | `@WebMvcTest` slice: the allowed roles get through (positive direction) | `privacy/PrivacySecurityRuleTest` |
| `*IT` | real Postgres via Testcontainers, extends `IntegrationTestBase` (needs Docker) | `client/ClientServiceIT` |

**New endpoint → add it to `EXPECTED` in `common/security/EndpointRoleMatrixIT`** and a
matching rule in `SecurityConfig` (deny-by-default; an unclassified route fails the build).
That IT sends a real CUSTOMER token at every non-customer route — the negative direction
is covered there for all modules, not in the per-module tests.

Run: `mvn test` (unit) / `mvn verify` (everything CI runs). CSRF helper: `common/CsrfTestSupport.xsrf()`.
