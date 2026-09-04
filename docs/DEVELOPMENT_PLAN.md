# Development Plan — Sequential Build Order

> **This is the execution file.** It is not product scope (`ROADMAP.md`), not
> pricing design (`PRICING.md`), not feasibility analysis
> (`VISION_AND_EXTENSIBILITY.md`). It is the **ordered list of what to build,
> and in what sequence**, so that any engineer (or Claude) can open this file,
> find the next unchecked box, and know exactly what to do next and why.
>
> **How to use it:** work top to bottom. Do not start a phase until the phase
> above it is checked. Each task links to the doc that specifies it. When you
> finish a task, tick its box and, if the design changed, update the linked doc.
>
> **Golden rules (do not violate without updating this header):**
> 1. **The two keystones come first.** Almost every future feature sits on
>    _entitlements_ + _payments_. Building a feature before its keystone means
>    scattering `if (plan === 'PRO')` and re-writing payment paths later.
> 2. **Enforcement is server-side.** A UI gate is a suggestion. The server
>    decides capability and computes money — never the client. See `PRICING.md` §6.
> 3. **Non-breaking, additive migrations.** Existing STARTER tenants use
>    everything today (`PRICING.md` §7.8). New gates must not silently take a
>    working feature away — show + upgrade-prompt, never hard-remove. This is the
>    owner's explicit call (feedback #5).
> 4. **One feature = one module.** Backend is a feature-modular monolith
>    (`{feature}/{controller,domain,dto,repository,service}`). A new feature is a
>    new package, not a change to an existing one.
> 5. **Don't gate table stakes.** Anything needed to run a first booking stays in
>    Starter (`PRICING.md` §2, §5).

---

## Status legend

- `[ ]` not started · `[~]` in progress · `[x]` done
- **Keystone** = everything downstream depends on it.

---

## Phase 0 — Cheap wins ✅ DONE

The UI-only groundwork that needed no backend. All shipped.

- [x] **Leads before Bookings** in the photographer sidebar (feedback #1) — Instagram-first triage flow (`ROADMAP.md` §4.5). `apps/web/src/app/(dashboard)/layout.tsx`.
- [x] **Shared list/detail styles** for Bookings/Leads/Clients (feedback #2) — single source of truth in `apps/web/src/lib/list-detail-styles.ts`; ~1600 lines of duplicated CSS removed.
- [x] **Photographer Payments tab** as an honest role-aware stub (feedback #3) — `/payments` branches on `useIsPhotographer`; photographer sees a money-hub preview, client keeps the bill-paying view. `apps/web/src/app/(dashboard)/payments/page.tsx`.

**Optional follow-up (not blocking):** extract shared _components_ (`PageHeader / DataList / Card / StatusPill`) from the now-shared styles. `components/ui/` and `components/layout/` are still empty. Do this the next time a fourth list/detail page is added, not before.

---

## Phase 1 — KEYSTONE: Entitlement layer 🔑 (in progress)

**Goal:** one place that maps `plan → capabilities`, read by **both** API and UI,
enforced **server-side**. Without it every gate becomes an ad-hoc
`if (plan === 'PRO')`. Spec: `PRICING.md` §6.3. This unblocks feedback #4/#5 and
5 of the 6 vision items.

**Design (as built — keep this section in sync with the code):**

- `Plan` enum — `STARTER · PRO · STUDIO`, with `fromString()` falling back to
  `STARTER` for unknown/legacy values (the DB column stays a `String`; we parse
  at the boundary, no migration needed).
- `Capability` enum — the **boolean** feature flags that a plan grants
  (e.g. `INSTAGRAM_AUTOMATION`, `CONTRACTS_ESIGN`, `GOBD_INVOICES`,
  `ANALYTICS_REPORTS`, `TEAM_SEATS`, `WHITE_LABEL`, `PRIORITY_SUPPORT`).
- `Entitlements` — the central matrix: for each `Plan`, its `Set<Capability>`
  **plus the scalar entitlements** (`commissionBps`, `galleryRetentionDays`,
  `photographerSeats`). PRICING §6.3 note: the commission _rate_ is an
  entitlement too, not just a boolean.
- `EntitlementService` — `entitlementsFor(plan)`, `hasCapability(plan, cap)`,
  and `requireCapability(plan, cap)` (throws `403`) as the server-side guard.
- **Wire to FE:** `capabilities: string[]` added to `MeResponse.TenantInfo` and
  `AuthResponse.TenantInfo` (additive — existing clients ignore it). FE reads it
  from `authStore` and gates nav via `requiresCapability`.

### Backend

- [~] Create `entitlement` module: `Plan`, `Capability`, `Entitlements`, `EntitlementService`.
- [~] Add `capabilities` to `MeResponse.TenantInfo` **and** `AuthResponse.TenantInfo` (keep the two in sync — see the comment in `MeResponse.java`).
- [~] Populate `capabilities` at the 3 construction sites: `AuthService.toMeResponse`, `AuthService.buildAuthResult`, `CustomerAuthService` (~line 235).
- [ ] **Do NOT retro-lock existing endpoints yet.** Grandfathering is an open question (`PRICING.md` §7.8). The guard exists; apply it per-feature as each gated feature ships, not in a big-bang sweep.
- [ ] _(Later)_ Server-side enforcement ergonomics: a `@RequiresCapability` annotation + interceptor so controllers declare gates instead of calling the guard by hand. Ships when the first real gate lands.
- [ ] _(Later)_ Expose scalar entitlements (`commissionBps`, retention, seats) on the wire when their feature needs them (Phase 3 / 4).

### Frontend

- [~] `lib/entitlements.ts` — `Capability` string-union, `CAPABILITY_PLAN` (which plan grants each — presentation only), `PLAN_RANK`, `hasCapability(user, cap)`, `planThatGrants(cap)`.
- [~] `authStore.ts` — add `capabilities: string[]` to `AuthUser.tenant`; add `useHasCapability(cap)` selector.
- [~] Nav — `NavLeaf.requiresCapability?`; render a plan lock badge ("PRO"/"STUDIO") when the user lacks it. Demonstrate on `/reports` + `/revenue` (Studio · `ANALYTICS_REPORTS`).
- [ ] _(Later)_ A reusable `<UpgradeGate requires={cap}>` wrapper + a `/settings/plan` upgrade screen, for gating whole pages (not just nav rows).

**Acceptance:** a STARTER photographer sees the Reports/Revenue rows with a
"STUDIO" lock; the server sends `capabilities` in `/api/auth/me`; nothing that
worked before is removed. `mvn compile` + `tsc --noEmit` green.

---

## Phase 2 — KEYSTONE: Stripe Connect onboarding 🔑

**Goal:** photographers can onboard a Stripe **Connect Express** account (KYC),
so the platform can later take an `application_fee_amount`. Spec: `PRICING.md` §4.
This is the prerequisite for _any_ real payment.

- [x] New `payment` module — 4-layer (`api · application · domain · infrastructure`), the first built to the full `BACKEND_FOUNDATION.md` standard. `StripeAccount` entity (public schema, tenant ↔ Stripe account id + onboarding status), `StripeConnectService`, and the Stripe SDK sealed behind a `StripeConnectGateway` port + `StripeConnectGatewayImpl` adapter. Migration `V11__create_stripe_accounts.sql`.
- [x] `POST /api/payments/connect/onboard` → creates/reuses the Express account and returns a hosted onboarding link. Plus `GET /api/payments/account` for payout-setup status.
- [x] `account.updated` webhook (`POST /api/payments/webhook`) → signature-verified, resolves tenant via the global `stripe_account_id` lookup, persists charges/payouts/details flags and recomputes onboarding status. Wired in `SecurityConfig` (permitAll + CSRF-exempt; onboarding/status gated to PHOTOGRAPHER/ADMIN). **Test-mode by default** — a blank `STRIPE_SECRET_KEY` boots fine and the endpoints answer "not configured"; go-live is a key swap.
- [x] FE: payout-setup card on the photographer Payments page (`apps/web/.../payments/page.tsx` → `PayoutSetupCard`), driven by `GET /api/payments/account` via the `usePaymentAccount` hook. Four states (NOT_STARTED / PENDING / ACTIVE / RESTRICTED); the CTA calls `POST /connect/onboard` and redirects to Stripe's hosted flow. Translated (`payments.payout.*`, DE + EN). Invoices/reconciliation stay "soon" previews.
- [ ] Entitlement tie-in: `commissionBps` from Phase 1 is read here (Starter 200 / Pro·Studio 0). Deferred to Phase 3 (it only matters when a charge is created).

**Blocker to note:** the commission must be disclosed in the AGB before charging
(`PRICING.md` §4 #3, and the legal-pages issue). Legal sign-off gates go-live.

---

## Phase 3 — Payments, invoices & commission

**Goal:** actually move money, with the plan-derived commission.

- [ ] `Invoice` / `Payment` entities (GoBD-conform invoices for the German market — a Pro capability, `GOBD_INVOICES`).
- [ ] Charge deposits via Stripe Connect with `application_fee_amount` **computed server-side** from the tenant's plan (never sent by the client — `PRICING.md` §6).
- [ ] Replace the photographer Payments stub with the real money hub: invoices (sent/paid/overdue), deposit & balance tracking, payout reconciliation.
- [ ] Wire the client Payments page's "Pay" buttons to real Stripe Checkout (they are `ComingSoon` stubs today).

---

## Phase 4 — Billing (subscriptions & trial)

**Goal:** the plans become sellable, not just announced.

- [ ] Stripe subscription per tenant; plan changes + proration.
- [ ] Trial-expiry logic — the 14-day trial is advertised with **no expiry logic at all** today (`PRICING.md` §7.7). Decide: downgrade / read-only / suspend.
- [ ] Grandfathering policy for existing all-on-STARTER tenants (`PRICING.md` §7.8) — resolve before any hard gate.
- [ ] `/settings/plan` upgrade/downgrade UI.

---

## Phase 5 — Vision features (feature-modular, in impact order)

Each is a new module that clips onto the keystones above. None needs an
architectural change. Full feasibility: `VISION_AND_EXTENSIBILITY.md` §4.

- [ ] **Instagram growth** (vision #5, **Pro anchor — already sold, must ship**) — `ROADMAP.md` §4.5: DM auto-reply webhook, bio-link request flow, story/post stickers. `source=INSTAGRAM` is already modelled. Gate: `INSTAGRAM_AUTOMATION` (Pro).
- [ ] **Map / location scouting** (vision #2, **the differentiator — no competitor has it**) — new `location` module (geo data), FE map component, UGC moderation. Photographers share scouted spots & angles.
- [ ] **Studio marketplace** (vision #6, highest revenue potential) — new `STUDIO` role + `studio` module; studios list space & hourly rates; photographers search/book; reuse the `booking` module; payments via Phase 2/3.
- [ ] **Training / coaching** (vision #1) — new `training` module; entitlement decides who can sell; payments/payout; content hosting.
- [ ] **Workshops / paid video lessons** (vision #3) — `course` module; shares infra with training; video storage (R2 exists).
- [ ] **Equipment / technique guide** (vision #4, **can ship any time**) — `guide` content module. The only vision item with **no keystone dependency** (no money, no gate). Good candidate to slot in whenever there's slack.

---

## Cross-cutting backlog (pull in as needed)

- [ ] **Gallery retention & deletion job** — `PRICING.md` §4b + `adr/001-gallery-retention-and-deletion.md`. Four hard requirements gate it (client reminder emails, photographer extend, soft-delete-then-hard, AGB wording). **Never ship expiry without all four** — it destroys clients' wedding photos irreversibly.
- [ ] **Multi-user / seats** for Studio (`TEAM_SEATS`) — no multi-user support exists yet; needed for the Studio plan and for the studio marketplace's staff.
- [ ] **Legal pages** — Impressum / Datenschutz / AGB are DRAFT placeholders; a launch blocker for charging commission (see the legal-pages issue).
- [ ] **Freeze `PRICING.md`** — answer open questions §7.5–§7.11 so the landing page and entitlement matrix have one agreed source.

---

## Backend module standard

The target architecture for **new** backend modules is
[`BACKEND_FOUNDATION.md`](BACKEND_FOUNDATION.md) (v1.0). **Adoption rule (its own
golden rule #10):** new modules adopt the four-layer `{api · application · domain
· infrastructure}` structure; the existing 14 modules are **not** rewritten —
they migrate opportunistically, never in a big bang. The first module to be
built to the full standard is **`payment`** (Phase 2).

Current state vs the standard (assessed 2026-07-26):

| Principle | Status | Note |
|---|---|---|
| Feature-first packages | ✅ | 14 modules under `com/photographplatform/api/{feature}` |
| Modular monolith · single deploy | ✅ | |
| Schema-per-tenant · Flyway | ✅ | |
| Auth isolated (JWT · refresh · magic link) | ✅ | `auth` module |
| Global exception handling + hierarchy | ✅ | `GlobalExceptionHandler` (+ `PlanUpgradeRequiredException` added this session) |
| DTOs, never entities | ✅ | records; entities never serialized |
| Audit trail | ✅ | `audit` module |
| **Event-driven** | 🟡 partial | `LeadCreatedEvent`, `InquiryCreatedEvent`, and now `BookingCreatedEvent` (→ `BookingConfirmationService` client email, added 2026-07-26) with `@EventListener` notifications; the pattern is established — payment/invoice still to adopt it |
| **Enforced module boundaries** | ✅ | `ArchitectureTest` (ArchUnit) fails the build on any *new* cross-module repository/controller access or feature cycle; frozen baseline 59 repo / 37 cycle / 0 controller, ratchet-down only (added 2026-07-26) |
| **Feature flags / entitlements** | 🟡 partial | entitlement layer built this session (`EntitlementService`, `Capability`) — the feature-flag foundation; not yet wired to gate endpoints |
| **4-layer internal split** | ❌ | current is `{controller · domain · dto · repository · service}` — no explicit `application`/`infrastructure` layer |
| **MapStruct** | ❌ | mapping is manual (constructors/records) |
| **API versioning** (`/api/v1`) | ❌ | all routes are `/api/...` |
| **Observability** (Actuator/Micrometer/Sentry) | ❌ | none in `pom.xml` |
| Integration adapters (Stripe/etc.) | ❌/n-a | Stripe unbuilt; when built it must live behind an adapter (Phase 2) |

**Reading:** the codebase already embodies most of the standard's _principles_;
the open deltas are mostly _mechanics_ (layer split, MapStruct, versioning,
observability) best introduced with the `payment` module rather than retrofitted.

## Reference map

| Doc | What it owns |
|---|---|
| `ROADMAP.md` | Product scope, sprint planning, Instagram flow (§4.5). Master Sənəd v4.1. |
| `PRICING.md` | Plan tiers, commission (§4), retention (§4b), entitlement design (§6.3), implementation order (§6). |
| `VISION_AND_EXTENSIBILITY.md` | Feasibility of the 6 future ideas vs the architecture; the two keystones. |
| `BACKEND_FOUNDATION.md` | The backend architectural standard (v1.0) every new module must follow. |
| `adr/001-gallery-retention-and-deletion.md` | The deletion-job requirements. |
| `adr/002-modular-monolith-and-scaling.md` | Why one deploy; when to extract a module; where serverless fits. |
| **`DEVELOPMENT_PLAN.md`** (this file) | The ordered build sequence across all of the above. |
