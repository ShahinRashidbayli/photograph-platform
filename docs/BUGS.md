# Bug Inventory

Stabilization pass, opened 2026-09-15. Evidence-based: every open item was
reproduced against the code on `feat/auth-flow-overhaul-adapted` (116 commits
ahead of `main`), either by a live request to the running API, a failing test,
or a specific `file:line`. Anything not reproduced is marked **suspected** with
what would confirm it.

**No open bug below is fixed until its fix is approved (Phase 3).** The
pre-Phase-1 fixes at the bottom are already committed.

Severity: `critical` (auth bypass / data integrity / money) · `high` (data
disclosure, silent test/CI loss) · `medium` · `low`.

---

## Open bugs (severity order)

| ID | Sev | Area | Description | Evidence | Repro | Test level |
|----|-----|------|-------------|----------|-------|-----------|
| BUG-002 | critical | Security / authz | ✅ **FIXED — see commit below.** **A CUSTOMER can overwrite the studio's legal Impressum and VAT ID.** `PUT /api/tenant/legal` has no `SecurityConfig` matcher and `TenantLegalService.updateOwn` has no role check, so it falls through to `anyRequest().authenticated()`. A logged-in customer (same tenant) can rewrite `legalName`, `legalVatId`, `legalResponsible`, etc. — the legally-required, publicly-served imprint. | `SecurityConfig.java:87-160` (no `/api/tenant/**` rule); `TenantLegalController.java:88`; live: CUSTOMER token → `PUT /api/tenant/legal {"legalName":"PWNED BY CUSTOMER","legalVatId":"DE-ATTACKER-999"}` → **200**, read-back confirmed the write. Restored afterwards. | Log in as CUSTOMER of tenant T (login-code flow); `PUT /api/tenant/legal` with a body; observe 200 and mutated imprint. | Integration (MockMvc, CUSTOMER token → expect 403) |
| BUG-003 | high | Security / authz | ✅ **FIXED — see commit below.** **A CUSTOMER can read the studio's staff roster and the owner's email.** `GET /api/team` falls through to `authenticated()`; the controller only calls `requireCurrentTenantId/UserId`, no role gate. Returns member emails, names, staff roles, seat counts. | `TeamController.java:58-79`; live: CUSTOMER token → `GET /api/team` → **200** `{"members":[{"email":"reshidshahin@outlook.com","staffRole":"OWNER",...}],"seatsTotal":3,...}`. | CUSTOMER token → `GET /api/team` → 200 with staff PII. | Integration |
| BUG-004 | high | Security / authz | ✅ **FIXED — URL rule + service-layer guard.** **A CUSTOMER can read, create and edit the studio's resources (rooms/kit).** `/api/resources` GET/POST/PUT have no matcher; `ResourceService` only scopes by `requireCurrentTenantId()`, no role check. | `SecurityConfig.java` (no `/api/resources/**` rule); `ResourceController.java:36-55`; `ResourceService.java:51` (tenant only). Live: CUSTOMER → `GET /api/resources` → **200**. POST/PUT confirmed reachable by code (no service-layer guard). | CUSTOMER token → `GET/POST/PUT /api/resources`. | Integration |
| BUG-005 | high | Security / authz | ✅ **FIXED — see commit below.** **A CUSTOMER can read the studio's revenue analytics** on analytics-capable (STUDIO) tenants. `GET /api/analytics` has no matcher. `AnalyticsService` guards with `requireCapabilityForCurrentTenant(ANALYTICS)` — a **plan** gate, not a **role** gate — so any authenticated user on a STUDIO tenant passes. | `AnalyticsController.java:36`; `AnalyticsService.java:67` (capability, not role); live: CUSTOMER on STUDIO tenant → `GET /api/analytics` → **200** with `revenue{invoicedCents,collectedCents,...}`. | CUSTOMER of a STUDIO tenant → `GET /api/analytics` → 200. | Integration |
| BUG-006 | high | Reliability / email | ✅ **FIXED — non-retrying client for the two HTTP transports.** **The email sender sleeps out a provider's `Retry-After` on the request/async thread.** Apache HttpClient5 (via `stripe-java`, runtime scope) backs Spring's `RestClient`; its default retry strategy honours a 429/503 `Retry-After` by sleeping. `SendGridEmailSender`/`ResendEmailSender` inherit it. Chain: provider 429 → sender thread sleeps for the header's seconds → the `@Async` pool (core 8 / max 24 / queue 500) fills → `CallerRunsPolicy` runs the next send on the **caller (request) thread** → user requests block. `spring.http.client.read-timeout: 10s` does not bound this (the sleep is between attempts). Same root mechanism as BUG-001. | `SendGridEmailSender.java:26,55`; `ResendEmailSender.java:25`; `AsyncConfig.java:53-67` (`CallerRunsPolicy`); HttpClient5 `DefaultHttpRequestRetryStrategy`. | Suspected in production (no SendGrid/Resend 429 reproduced locally); confirm by stubbing a provider 429 with `Retry-After` and asserting the sender does not sleep. | Unit (sender + a stubbed 429) |
| BUG-007 | high | Test / tenant isolation | ✅ **FIXED — helper repointed at the login-code route; all four assertions unchanged.** **`SharedEmailAcrossTenantsIT` (3 tests) is stale and never ran until now.** It POSTs `/api/auth/customer/magic-link/request`, a route deleted when customer login moved to 6-digit codes (`CustomerAuthController` now maps only `login-code/{request,verify}`). The missing route falls to the CSRF filter and returns 403, so the tests fail `expected 204 but was 403`. The behaviour they protect is **cross-tenant isolation** of a shared customer email — do not delete or disable; rewrite against the login-code flow keeping the same cross-tenant scenario. | `mvn verify`: `SharedEmailAcrossTenantsIT.*:65,91,109 → requestMagicLink:149 expected 204 but was 403`; confirmed identical on the pre-BUG-001 tree, so not caused by the retry fix. | `mvn verify` (JDK 21). | Integration (rewrite) |
| BUG-008 | medium | Authz / correctness | ✅ **FIXED — URL rule + service-layer guard.** **A CUSTOMER can delete their own account via `POST /api/team/leave`.** No matcher; `leaveStudio` finds the actor, sees they are not the owner, and `userRepository.delete(actor)` — deleting the customer's user row and audit-logging it as `STAFF_LEFT`. Self-only (no cross-tenant), but an unintended state transition, a mislabeled audit entry, and `bookings.customer_user_id` then dangles. The other team mutations (`invitations`, `members/{id}`, `transfer-ownership`) are safe: they call `ownershipGuard.requireOwner`, which throws for a non-owner. | `StaffInvitationService.java` `leaveStudio` (no `requireOwner`, deletes actor); contrast `removeMember`/`transferOwnership` (both `requireOwner`). | CUSTOMER token → `POST /api/team/leave` → 204, user row gone. | Integration |
| BUG-014 | critical | Security / logging | ✅ **FIXED — logs now name provider, type and tenant only.** **Customer sign-in codes and every recipient address were written to the application log.** The login email's subject is literally `"Your sign-in code: " + code`, and all four transports logged `to='{}' subject='{}'` at INFO on every successful send — `EmailService` logged the same pair on failure. So each send put a live credential and the mailbox it belongs to, together, into the log; anyone with log access could sign in as that customer inside the code's 10-minute life. | `CustomerAuthService.java:376` (code in the subject); `SendGridEmailSender`/`ResendEmailSender`/`SmtpEmailSender`/`NoOpEmailSender` (`LOG.info(... to ... subject ...)`); `EmailService.send` (same on the error path). Measured in one test run's output: **9 login codes and 34 recipient addresses** before the fix, **0 and 0** after. | Send any customer login code and read the application log. | Unit |
| BUG-012 | medium | Security / auth | **Login-code guessing is unbounded while Redis is down.** `RateLimiter` fails open by design (documented in its javadoc: a Redis outage should degrade, not become an outage). Every request-side limit on the customer login code lives there — 5/hour per email, 20/hour per IP, 30/hour per IP on verify — so a Redis outage removes all of them. What survives is the per-code attempt cap of 5, which is enforced in Postgres (`magic_link_tokens.attempts`). But codes can then be re-requested without limit, and each request issues a fresh code, so the attacker's budget becomes unbounded 5-guess rounds against a 6-digit secret with a 10-minute life. **Must be closed before going live.** Proposed direction (approved, not yet implemented): when Redis is unreachable, fall back to a Postgres-side per-email request limit — count codes issued for that user in the last hour from `magic_link_tokens` and refuse beyond the same threshold. The general rate limiter keeps failing open. | `RateLimiter.java:35-45` (fail-open rationale), `:141-147` (returns null on any `RuntimeException`); `CustomerAuthService.java:99-102` (all three limits are Redis-backed), `:262` (the DB-backed cap that survives). | Stop Redis; request login codes for one email in a loop — no limit applies. | Integration (Redis down + request loop) |
| BUG-013 | low | Security / auth | **The login-code hash is compared with `String.equals`, not a constant-time comparison.** The attacker controls `code` and therefore the hash being compared, so the comparison is in principle timing-observable. Not practically exploitable here — the attempt cap burns the code after 5 guesses and network jitter dwarfs the signal — but it is inconsistent with the rest of the codebase, which already uses a constant-time compare for the CSRF token. Fix: `MessageDigest.isEqual` on the byte arrays. | `CustomerAuthService.java:258` (`token.getTokenHash().equals(...)`); contrast `SecurityConfig.java` `constantTimeEquals` for CSRF. | Code inspection. | Unit |
| BUG-009 | medium | Build / deps | **The root `overrides` block (`postcss: ^8.5.10`) is not applied by npm 11.16.0 in this workspace.** It never reaches the lockfile's root `overrides` key, so the pin lives only as a hand-written lockfile entry. Any plain `npm install` re-resolves `postcss` to next's exact `8.4.31` pin (4 advisories: GHSA-qx2v-qp2m-jg93, -6g55-p6wh-862q, -fxqj-rqcc-2cmp, -r28c-9q8g-f849) and `npm ls` calls the intended 8.5.26 "invalid". The pin is one careless install from silently regressing. | `package.json` has `overrides.postcss`; `package-lock.json` root has no `overrides`; `npm ls postcss` → `8.4.31` after a bare install, `invalid: 8.5.26` after manual re-pin. Reproduced twice this session. | `rm -rf node_modules/postcss && npm install` → 8.4.31. | — (root-cause investigation) |
| BUG-010 | low | Test | ✅ **FIXED — expectation aligned to the API-wide 422.** **`CustomerAuthControllerIT.malformedCodeIsRejectedAtTheEdge` expects 400 but the API-wide rule is 422.** `GlobalExceptionHandler` maps `@Valid`/`MethodArgumentNotValidException` and `IllegalArgumentException` to **422 UNPROCESSABLE_ENTITY** uniformly (lines 127, 157). The malformed 6-digit `code` fails `@Pattern` → 422, per the rule. The frontend is status-agnostic for validation: `customer/auth/login/page.tsx` validates the code format client-side first and, on any error, reads `response.data.error` (never the numeric status). So the **test expectation deviates from the platform convention**, not the code, and no runtime/FE behaviour depends on it. | `mvn verify`: `CustomerAuthControllerIT:169 expected 400 but was 422`; `GlobalExceptionHandler.java:135-157`; `apps/web/src/app/customer/auth/login/page.tsx:172,187-191`. | `mvn verify`. | Integration (align test to 422) |
| BUG-011 | low | Error handling | **A deleted route returns CSRF 403 instead of 404.** The stateless CSRF filter runs before dispatch and rejects any unknown mutating path that carries no `X-XSRF-TOKEN` (e.g. the removed `POST /api/auth/customer/magic-link/request`), so a caller of a nonexistent endpoint gets a misleading 403. Surfaced by BUG-007. | `SecurityConfig.java:234-260` (StatelessCsrfFilter runs pre-dispatch); observed in the BUG-007 failures. | POST any unknown `/api/...` path with no CSRF header → 403. | — |

---

## Role matrix — all 117 endpoints

Derived from `SecurityConfig` (Ant matchers, first-match-wins, ending in
`anyRequest().authenticated()`), reconciled against live probes. Full listing:
`scratchpad/rolematrix2.txt`. Distribution: **permitAll 23 · PHOTOGRAPHER,ADMIN
71 · PHOTOGRAPHER,ADMIN,CUSTOMER 2 · CUSTOMER 7 · ANY-AUTH (fall-through) 14**.

The 14 that fall through to `authenticated()` are the only place intent and
enforcement can diverge. Verdict per endpoint:

| Endpoint | Enforced | Intended (javadoc/purpose) | Verdict |
|----------|----------|----------------------------|---------|
| `GET /api/tenant/legal` | any-auth | PHOTOGRAPHER,ADMIN | **BUG-002** (leak; public variant exists but this is the editor view) |
| `PUT /api/tenant/legal` | any-auth | PHOTOGRAPHER,ADMIN | **BUG-002** (write) |
| `GET /api/team` | any-auth | PHOTOGRAPHER,ADMIN | **BUG-003** |
| `GET /api/resources` | any-auth | PHOTOGRAPHER,ADMIN ("Role-gated … by SecurityConfig") | **BUG-004** |
| `POST /api/resources` | any-auth | PHOTOGRAPHER,ADMIN | **BUG-004** |
| `PUT /api/resources/{id}` | any-auth | PHOTOGRAPHER,ADMIN | **BUG-004** |
| `GET /api/analytics` | any-auth (+plan gate) | PHOTOGRAPHER,ADMIN | **BUG-005** |
| `POST /api/team/leave` | any-auth | staff only | **BUG-008** |
| `POST /api/team/invitations` | any-auth | OWNER (`requireOwner`) | OK — service throws for non-owner (defense-in-depth only, no filter gate) |
| `DELETE /api/team/invitations/{id}` | any-auth | OWNER | OK — `requireOwner` |
| `DELETE /api/team/members/{id}` | any-auth | OWNER | OK — `requireOwner` |
| `POST /api/team/transfer-ownership` | any-auth | OWNER | OK — `requireOwner` |
| `GET /api/customerBookings` | any-auth | scoped to caller identity | OK — a photographer gets their own (empty) list |
| `GET /api/entitlements` | any-auth | any authenticated user (reads own plan) | OK — plan is already in `/api/auth/me` |

**Common root cause (BUG-002…005, and the shape of 008):** authorization is a
single allow-list in `SecurityConfig` ending in `anyRequest().authenticated()`.
Any controller prefix without a matcher silently inherits "any logged-in role."
Four prefixes — `/api/tenant`, `/api/team`, `/api/resources`, `/api/analytics`
— were added without a matcher. Fix options for you to choose (Phase 3):

- **A. Flip the default to deny.** Add a catch-all `anyRequest().denyAll()` (or
  a role floor) and make every surface opt in.
  - `+` A new controller without a rule is unreachable, not wide-open — the
    failure mode becomes a visible 403, not a silent leak.
  - `−` Every legitimately-authenticated surface (`/api/auth/me`,
    `customerBookings`, `entitlements`) needs an explicit rule or it breaks;
    higher one-time churn and a chance of over-blocking.
- **B. `@PreAuthorize` on the controllers/methods.** Enable method security and
  annotate each admin surface (`hasAnyRole('PHOTOGRAPHER','ADMIN')`).
  - `+` Authorization sits next to the handler it protects; survives URL moves;
    granular per method.
  - `−` Two sources of truth (filter + annotations); an unannotated new method
    still falls through unless paired with option A; needs `@EnableMethodSecurity`.
- **C. An ArchUnit rule.** Assert every `@RestController` request path is
  covered by an explicit `SecurityConfig` matcher (fail the build otherwise).
  - `+` Catches the *class* of mistake at build time, repo already uses ArchUnit.
  - `−` Enforces "a rule exists," not "the rule is correct"; a wrong matcher
    still passes. Best as a complement to A or B, not a replacement.

Recommendation to discuss: **A + C** (deny-by-default closes the hole; ArchUnit
keeps it closed), with B where a single path needs mixed roles.

---

## Tenant isolation / RLS scan

**What the tests cover.** `TenantIsolationIT` is *not* table-level — 2 tests
(`jwtScopedToItsOwnTenant`, `invalidTokenReturns401`) asserting JWT↔tenant
binding via `/api/auth/me`. The real per-table RLS test is
`RlsCrossTenantIsolationIT.eachTenantScopedTableIsIsolatedByRls`, covering **11
tables**: clients, categories, photos, packages, bookings, leads, galleries,
delivery_photos, inquiry_requests, studio_resources, booking_resources.

**Tables with a `tenant_id` column but no RLS policy** (asked): `audit_log`,
`refresh_tokens`, `staff_invitations`, `users`. **Not a bug** — `V11` documents
this as deliberate (auth flows query these before a tenant is bound: login by
email across tenants, refresh by token hash), and app-level scoping is present
and verified: `AuditLogRepository.findByTenantIdAndEntityType…`,
`StaffInvitationRepository.findByTenantIdOrderByCreatedAtDesc`. Recorded here so
the choice is visible, not to change it.

**Tables with RLS enabled but not exercised by the isolation test** →
Follow-up FU-4: contracts, invoices, invoice_line_items, invoice_counters,
payments, feature_interest, gallery_expiry_reminders. They have policies;
they just lack a dedicated cross-tenant assertion.

---

## Unfinished (WIP)

Not bugs — features mid-build (last three commits are `wip(api)`/`wip(web)`).
Listed so they are not mistaken for regressions. **Exception:** BUG-002…005 and
BUG-008 above touch WIP surfaces (`/api/tenant/legal`, `/api/resources`,
`/api/analytics`, contracts) but are filed as normal bugs because they are
security holes.

| Area | State | Note |
|------|-------|------|
| Contracts module (BE + UI) | Wired | `ContractController` + `CustomerContractController` live; `contracts/page.tsx` + `BookingContracts.tsx` render them; `ContractLifecycleTest` green. Newly added (`wip(api)`), no integration coverage of the customer-sign path yet. |
| Plan gating UI | Partial | `settings/plan`, `PlanComparison`, `UpgradeCard`, `PlanUpgradeDialog`; server enforcement via `EntitlementService`. Self-serve Checkout hidden until the 6 `STRIPE_PRICE_*` ids are set (by design). |
| Settings split into routes | Wired | `settings/{business,studio,team,payments,plan}` routes exist. |
| Roadmap interest / revenue source | Wired | `RoadmapController`, `FeatureInterest`, `RevenueSource`. |
| Orphaned i18n keys (25) | Cleanup | `stubs.*`, `contracts.status.*`, `settings.team.status*`, `chrome.notifications.*` are defined-but-unused — leftover from rewiring reports/revenue/documents to real data. `i18n:check` lists them (non-failing). |

---

## Follow-ups (note only; not this pass's scope)

- **FU-1 (critical): ~~CI has never run integration tests or the quality
  gates~~ — FIXED, `ed81509`.** The last CI run had been 2026-07-22; this
  branch's 116 commits never triggered it (`ci.yml` fired only on push/PR to
  `develop`/`main`, no `workflow_dispatch`). `*IT` includes (2026-08-15) and
  `mvn verify` in CI (2026-08-24) both landed *after* that last run, which used
  `mvn test` and took 51s — so no `*IT` test, no coverage floor and no SpotBugs
  had ever executed in CI. Now: `push: ['**']`, `pull_request` on any target,
  `workflow_dispatch`, and the three `setup-java` steps read `.java-version`.
  First real run — [35031263249](https://github.com/ShahinRashidbayli/photograph-platform/actions/runs/35031263249),
  2026-09-15: **532 tests, 4 failures, 0 errors, 2m28s**. Testcontainers works
  on the runner (Postgres suites green; the quay.io MinIO pull succeeded, so
  `R2StorageServiceIT` ran there too). JDK resolved to Temurin 21.0.12 from
  `.java-version`, enforcer passed. The 4 failures are exactly BUG-007 (×3) and
  BUG-010 — no new failures, no infrastructure errors. Format, Lint, Test Web
  and Dependency audit are green (which also proves `npm ci` resolves
  `@testing-library/dom` again after the `.npmrc` fix). JaCoCo/SpotBugs still
  do not run: the build stops at the `test` phase while those 4 fail.
- **FU-2: JaCoCo floor comment unverifiable.** `pom.xml` claims "452 tests, LINE
  64.72% / BRANCH 48.57%" but a full `verify` had never completed. First green
  run measured **LINE 58.01% / BRANCH 44.17%** (below the 63%/46% floors — but
  with 4 tests failing and one class erroring, so not final). Do not touch the
  thresholds until a fully-green run; then replace the comment's numbers with
  the measured values.
- **FU-3: README says "schema-per-tenant"** (V11 replaced it with RLS) and
  `application.yml` has `spring.flyway.enabled: false` (migrations are manual via
  `make migrate`). Documentation drift; correct when touching docs.
- **FU-4: RLS isolation test gap** — see the RLS section: contracts, invoices,
  invoice_line_items, invoice_counters, payments, feature_interest,
  gallery_expiry_reminders have policies but no cross-tenant assertion.
- **FU-5 (partly resolved): sharp's advisories are cleared; the open question
  is now only whether `/_next/image` should exist at all.** sharp is at 0.35.4,
  which the libvips and libheif advisories are fixed in, and it got there
  without Next 16 — next 15.5.24 declares it as
  `optionalDependencies: sharp "^0.34.3 || ^0.35.3"`, a range npm accepts, so
  unlike the postcss pin (BUG-009) this survives any install. What remains is
  the design question below, unchanged: sharp still ships in the production
  bundle and `/_next/image` is live even
  though the app never uses `next/image`. Today's risk is low (no backend
  endpoint returns image bytes with an image content-type; `remotePatterns: []`
  blocks remote URLs; `/public` holds only 2 committed brand assets). Latent
  risk is real: the day a gallery photo is proxied through this origin, or a
  `remotePatterns` entry is added, `/_next/image` becomes a decoder for
  attacker-supplied bytes (libvips CVE-2026-33327/33328/35590/35591, libheif
  GHSA-g89c-p67h-r497 / -2jg2-4ch7-h545). `images.unoptimized: true` fully
  disables the route (verified: `/_next/image?...` → 404); sharp stays in the
  bundle regardless (removing it needs the Next 16 upgrade). Reverse-proxy
  blocking not needed. Decide whether to set `unoptimized`.
- **FU-6: Next 16 upgrade** (separate work) — clears the sharp advisories and
  the postcss pin fragility (BUG-009) at their source.
- **FU-8: `audit_log.old_value` / `new_value` are never populated.** All six
  action types present in the local database have both columns null — the call
  sites use the overload that omits them. So the trail records *that* something
  changed and *who* changed it, but not *what it changed from and to*. Start with
  `TENANT_LEGAL_UPDATED`: the Impressum and VAT id are exactly the fields a
  regulator or claimant would ask about, and `TenantLegalService.java:85-88` says
  so in its own comment. (Verified: the write from the BUG-002 probe *is* audited,
  with actor, tenant and IP — only the before/after is missing, so this is a
  follow-up and not part of BUG-002.)
- **FU-9: the README's deploy story does not match reality.** It says `main` is
  "Production — protected, auto-deploy", but `main` holds 8 files (READMEs and
  `ci.yml`) and no application code at all; every line of this product lives on
  `feat/auth-flow-overhaul-adapted`. Nothing is deployed today: `api.fotolio.de`
  and `app.fotolio.de` do not answer, and `fotolio.de` is a registrar 301 to an
  unrelated site. Before merging to `main`, write down what Railway will actually
  deploy (`apps/api/railway.json` → Dockerfile build, `preDeployCommand` runs
  Flyway `migrate`; `apps/web/railway.json` likewise) and which variables must
  exist first — at minimum `DB_URL`/`DB_USERNAME`/`DB_PASSWORD`,
  `FLYWAY_URL`/`FLYWAY_USER`/`FLYWAY_PASSWORD` (the runtime role is not the
  migration role — see V11), `JWT_SECRET`, `REDIS_HOST`/`REDIS_PORT`,
  `CORS_ALLOWED_ORIGINS`, `APP_WEB_BASE_URL`, `COOKIE_SECURE=true` +
  `COOKIE_SAME_SITE` + `COOKIE_DOMAIN`, the `EMAIL_PROVIDER` and its key, the four
  `R2_*` values, `STRIPE_SECRET_KEY` + both webhook secrets, and — for the web
  image — `API_BASE_URL` as a **build arg** (it is baked into
  `routes-manifest.json`; setting it at runtime does nothing). A first deploy
  with any of these missing fails in a way that only shows up in production.
- **FU-10 (before go-live): an outbox for email.** Delivery is best-effort by
  construction — `EmailService` is `@Async` and logs rather than throws — so a
  provider outage loses messages silently. `EmailType` now grades them by what
  losing one costs: sign-in codes, verification and invitations are recoverable
  (the user sees nothing happened and asks again); `CONTRACT_SIGNED` and
  `GALLERY_EXPIRY` fail invisibly and with consequences — a countersignature
  nobody knows to expect, or a gallery deleted on schedule after its only
  warning never arrived; lead and inquiry notifications are lost business,
  silently. Persisting the message and draining it from a job with its own
  retry schedule is the durable answer. No invoice or payment email exists yet —
  invoices are downloaded as PDFs, not mailed — so nothing here is currently a
  GoBD retention concern, but that changes the day one is added.
- **FU-11: `@Async` back-pressure — decide on `CallerRunsPolicy`.** The pool
  (core 8 / max 24 / queue 500) runs rejected work on the calling thread, so a
  saturated queue pushes background work onto request threads. BUG-006 removed
  the sleep that made that reachable, but the policy is still the reason a slow
  downstream anything becomes user-facing latency. It applies to audit writes
  and notifications too, not just email, so this is a deliberate decision to
  take rather than a line to change.
- **FU-12: three domain events do not carry the tenant.** `LeadCreatedEvent`
  and `InquiryCreatedEvent` hold the photographer's email and subdomain but no
  `tenantId`, so the email failures they trigger log `tenant=null` and cannot be
  attributed to a studio. Adding the field to those events is the fix.
- **FU-7: Date/time** — `Booking` stores `LocalDate eventDate` + `LocalTime
  eventTime` with no zone; timestamps are `OffsetDateTime`. No concrete DST bug
  found yet; a booking near a DST boundary is the scenario to probe in a later
  pass.

---

## Fixed before Phase 1 (committed)

| ID | Commit | What |
|----|--------|------|
| — | 6e8aecf | `chore(build)`: maven-enforcer `requireJavaVersion [21,22)` + `.java-version`; wrong JDK now fails in `validate`, not after the whole suite (JaCoCo can't instrument JDK 25 classes). |
| BUG-001 | 5ed7ba6 | `fix(test)`: disable the test HTTP client's auto-retry so it stops sleeping out a 429's `Retry-After`. `AuthControllerIT` ~40 min → 16s; every `*IT` class can now reach a runner. Assertions unchanged. |
| — | 059a6e6 | `style`: Prettier over 18 files CI's format job was red on. |
| — | 5d41ebd | `chore(deps)`: next 15.5.23 → 15.5.24 (fixes RCE advisories GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4). |
| — | 8690131 | `fix(test)`: point `R2StorageServiceIT` at quay.io (the mirror compose already uses; Hub refuses anonymous pulls) + repo `.npmrc` `legacy-peer-deps=false`. |
