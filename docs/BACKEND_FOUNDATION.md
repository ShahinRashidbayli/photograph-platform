# Fotolio Backend Foundation

## Building a Scalable, Extensible & Enterprise-Ready Backend

> **Version 1.0** — the architectural standard for the backend.
>
> This document does **not** describe how current features work. It defines
> **how every future feature must be built**. A good architecture should survive
> years of development without rewrites: every new feature follows the same
> pattern, and adding one should not force changes across existing modules.
>
> Companion docs: [`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md) (build order),
> [`VISION_AND_EXTENSIBILITY.md`](VISION_AND_EXTENSIBILITY.md) (why),
> [`PRICING.md`](PRICING.md) (plans/entitlements). A current-state gap
> assessment against this standard lives in `DEVELOPMENT_PLAN.md` §"Backend
> module standard".

The architecture should make it easy to: add modules · remove modules · extend
features · replace integrations · onboard developers · scale · test business
logic · maintain consistency.

---

## Core Principles

### 1. Feature First

Code is organised by **business capability**, not by technical layer.

```
✗ Bad (layer-first)          ✓ Good (feature-first)
controllers/                 booking/
services/                    lead/
repositories/                payment/
entities/                    client/
dto/                         portfolio/
                             instagram/
                             analytics/
```

Developers think in business domains, not technical layers.

### 2. Modular Monolith

The application starts as a **Modular Monolith** — not microservices.

Microservices add unnecessary MVP complexity: distributed transactions,
networking, deployment complexity, service discovery, monitoring, duplicated
infrastructure. A modular monolith gives a single deployment, single database,
simple debugging, high performance, and clear module boundaries.

If a module must one day become a microservice, the migration should be possible
**without rewriting business logic**.

### 3. Domain Driven Design (Lightweight)

Full DDD is often too heavy. We use **Rich Domain Models, Value Objects,
Aggregates where needed, and Domain Events** — without unnecessary abstractions.
Business rules live inside the domain.

### 4. Clean Layer Separation

Each module follows the same structure:

```
booking/
    api
    application
    domain
    infrastructure
```

---

## Module Structure

Every feature/module uses the same four layers.

### API Layer

- **Responsible for:** REST endpoints · validation · authentication · DTO mapping
- **Contains:** `BookingController`, `BookingRequest`, `BookingResponse`
- **Must NOT contain:** business logic · repository calls · calculations

Controllers only receive and return data.

### Application Layer

- **Responsible for:** use cases — `CreateBooking`, `CancelBooking`, `ApproveLead`, `GenerateInvoice`
- **Responsibilities:** orchestrates workflow · calls domain · publishes events · manages transactions
- **Must NOT:** know SQL · know HTTP · know the Stripe API

The application layer coordinates; it does not own business rules.

### Domain Layer — the heart of the system

- **Contains:** `Booking`, `Lead`, `Invoice`, `Client`, Policies, Specifications, Domain Services, Value Objects
- Business rules belong here, in exactly one place.

```
✗ Wrong:  if (depositPaid) { ... }   // inside a Controller
✓ Right:  booking.confirm();         // Booking decides if confirmation is allowed
```

### Infrastructure Layer

- **Responsible for:** external systems — JPA, Redis, Stripe, Instagram, Google Calendar, S3, Email, WebSockets
- Infrastructure can change; **business logic must never depend on infrastructure.**

---

## Package Strategy

```
com.fotolio
    auth        tenant      user        lead        inquiry
    booking     payment     invoice     portfolio   gallery
    notification analytics  reports     instagram   calendar
    ai          marketplace education   studio      common
```

Each package owns its own code.

### Shared / `common` Module

Stays very small. Contains: `BaseEntity`, Audit, Exceptions, Security,
Validation, Utilities, Constants, Response Models. **Avoid business logic here** —
`common` easily becomes a dumping ground.

---

## Authentication Module

Isolated. Contains JWT, Refresh Tokens, OAuth, Magic Link, Password Login,
Session Policies. Authentication evolves independently — future Google / Apple /
Instagram login must not affect business modules.

## Tenant Module

Multi-tenancy: `TenantResolver`, `TenantContext`, `TenantInterceptor`,
`TenantFilter`. Every request resolves the active tenant; **business modules
never manually determine the tenant.**

---

## Event Driven Architecture

Modules communicate through **events**, never through long service chains.

```
✗ Bad:  LeadService → BookingService → InvoiceService → NotificationService → AnalyticsService
✓ Good: LeadAcceptedEvent → BookingCreatedEvent → InvoiceGeneratedEvent → PaymentCompletedEvent
```

Loose coupling makes modules independent. Typical events: `LeadCreated`,
`LeadAccepted`, `BookingCreated`, `BookingCancelled`, `InvoiceGenerated`,
`PaymentReceived`, `GalleryDelivered`, `PortfolioPublished`, `ClientRegistered`.
Future modules simply subscribe; existing modules remain untouched.

---

## Stateless Application

Application servers stay **stateless** — never store users, sessions, or tenant
state in application memory. State belongs in PostgreSQL, Redis, Object Storage,
or a Message Queue. Benefits: horizontal scaling, cloud-ready, Kubernetes-friendly.

## Database & Migrations

- **PostgreSQL**, tenant strategy = **Schema Per Tenant** (strong isolation, easier backups, enterprise-friendly).
- Migrations always via **Flyway**. Never manually change the production database — versioning, rollback, repeatable deployments.

## Repository Rules

Repositories do **only** CRUD / persistence / queries. They must **not** send
emails, publish events, or calculate business logic.

A repository is a module's **private** door to its own tables. **No other module
may inject or call another module's repository.** Cross-module data flows through
the owning module's service/facade or a domain event — never a foreign
`…Repository`. This is the single most important boundary rule and it is
machine-enforced (see below).

---

## Enforced Boundaries — ArchUnit (added 2026-07-26)

Principles only hold if the build enforces them. `apps/api` ships an executable
architecture contract:
[`ArchitectureTest.java`](../apps/api/src/test/java/com/photographplatform/api/architecture/ArchitectureTest.java),
three rules that run in the normal `mvn test` phase (bytecode analysis only — no
DB, no Spring context):

1. **Repositories are module-internal** — nothing outside a module may depend on
   its `…repository…` classes.
2. **Business-feature modules are free of dependency cycles** — dependencies
   *into* the shared kernel are excluded (see below), so only real
   feature-to-feature entanglement is flagged.
3. **Controllers are not depended upon across modules** — the web layer is an
   entry point, never a dependency.

### The freezing baseline — a ratchet, not a wall

Applying strict rules to a codebase that predates them would break the build on
day one. Instead each rule is wrapped in ArchUnit's `FreezingArchRule`: the
**current** violations are recorded once as an accepted baseline in
[`archunit_store/`](../apps/api/src/test/resources/archunit_store) and the build
stays green — but **no new violation can be introduced**. A fresh boundary
breach fails `mvn test` immediately.

Baseline at introduction (2026-07-26): **59** cross-module repository
dependencies · **37** cyclic edges · **0** cross-module controller
dependencies. **These numbers must only ever go down.** The `archunit_store`
files are committed; when you remove a violation, a green run auto-prunes it.
If a legitimate refactor re-words a frozen violation (e.g. you change a
constructor signature that still has the same foreign-repository parameter),
re-record once with `mvn test -Dtest=ArchitectureTest -Darchunit.freeze.refreeze=true`
and confirm the counts did not rise.

---

## Shared Kernel

Not every module is a feature. A small set is **cross-cutting** — every module
is allowed to depend on it, and depending on it never counts as coupling:

| Kernel module | Why it is shared |
|---|---|
| `common` | `BaseEntity`, exceptions, security utils, `TenantContext`, shared events |
| `auth` | identity — the `User` aggregate is referenced everywhere |
| `tenant` | the `Tenant` aggregate + schema resolution |
| `audit` | fire-and-forget audit trail sink |
| `notification` | fire-and-forget email/push sink (subscribes to events) |
| `entitlement` | plan/capability checks gate many features |

The ArchUnit cycle rule ignores dependencies whose **target** is one of these,
so a cycle running through `auth`/`tenant` is not treated as business coupling.
Everything else is a **feature module** and must stay acyclic with its peers.

> Kernel modules should avoid depending *outward* onto feature modules. `auth`
> currently reaches into `notification`/`portfolio`; that is a smell to unwind,
> not a licence to add more.

---

## Migrating a synchronous side-effect to an event

The reference conversion (done 2026-07-26): booking creation now publishes
[`BookingCreatedEvent`](../apps/api/src/main/java/com/photographplatform/api/booking/event/BookingCreatedEvent.java);
[`BookingConfirmationService`](../apps/api/src/main/java/com/photographplatform/api/notification/service/BookingConfirmationService.java)
listens and emails the client — the booking module no longer needs to know email
exists. Recipe for any fire-and-forget cross-module call (e.g. the remaining
direct `auditService.log(...)` calls in feature modules):

1. Define an event in the **owning** module's `…/event` package (or `common/event`
   for a truly generic one), carrying everything a listener needs — never a
   foreign entity.
2. Publish it with `ApplicationEventPublisher` where the side-effect used to be
   called inline.
3. Add an `@Async @EventListener` in the **consuming** module (the sink), doing
   the work best-effort — the source transaction has already committed.
4. Update unit tests to assert the **published event** instead of the foreign
   mock; run the module's tests green before moving on.

This is how the 59-repository / 37-cycle baseline gets burned down without a
big-bang rewrite.

## DTO & Mapping

- **Never expose entities.** Always use DTOs: `BookingResponse`, `BookingSummary`, `BookingDetails`, `BookingCard` (security, API stability, versioning).
- Use **MapStruct** — compile-time safety, high performance, cleaner code.

## Validation

- **Input** validation via annotations (`@NotNull`, `@Future`, `@Email`).
- **Business** validation inside the domain (`Booking` validates itself — the controller does not).

## Exception Handling

Global only, via `@ControllerAdvice`. Hierarchy: `BusinessException`,
`ValidationException`, `NotFoundException`, `ConflictException`,
`AuthenticationException`, `AuthorizationException` → consistent API responses.

---

## Logging & Audit

- **Structured logging** only. Every request logs: Tenant · User · Correlation ID · Execution Time · Endpoint · IP · Status.
- **Audit trail** for critical operations (Booking Deleted, Invoice Edited, Payment Refunded, Portfolio Published, Lead Converted). Audit records: Who · When · What · Old Value · New Value.

## Notifications

Isolated module. Providers: Email, Push, SMS, WebSocket. Business modules
**publish events**; the notification module decides how to notify.

## Integrations

External systems live inside **adapters** (Stripe, Instagram, Google Maps,
Google Calendar, Resend, AWS S3). Business modules never call SDKs directly —
SDKs change frequently.

## Scheduler Module

Contains reminder jobs, invoice reminders, follow-up emails, Instagram sync,
calendar sync, referral emails. **Never** place scheduled jobs inside business
services.

## File Storage

Store files outside the application (Amazon S3, Cloudflare R2, Google Cloud
Storage, MinIO). Never store uploads locally.

## Cache Strategy

Use Redis for settings, templates, plans, feature flags, rate limits, magic
links. Do not cache business transactions blindly.

---

## API Design & Versioning

- REST, resource-based: `/bookings`, `/leads`, `/payments` (not `/getBookings`, `/createBooking`).
- Versioned: `/api/v1`; breaking changes → `/api/v2` for backward compatibility.

## Security

JWT · HTTPS · Refresh Tokens · Role-Based Access Control · Method Security ·
Rate Limiting · Input Validation. **Never trust client data.**

## Feature Flags

Every premium feature supports feature flags (Instagram Automation, Studio
Reports, Marketplace, Education, AI Assistant) — for staged rollout, beta
testing, and premium plans.

---

## Testing Strategy

1. **Unit tests** — domain only, fast.
2. **Integration tests** — Spring Boot + PostgreSQL + Redis via Testcontainers.
3. **End-to-end tests** — critical workflows (Lead → Booking → Invoice → Payment).

## Performance

Pagination · Lazy Loading · Batch Fetching · Connection Pooling · Read Models ·
Redis Cache. Avoid premature optimisation — **measure first.**

## Observability

Expose Health · Metrics · Tracing · Logs. Recommended: Spring Boot Actuator,
Micrometer, Prometheus, Grafana, Sentry.

---

## Future-Proof Design

Adding a new feature should look like this — and nothing else changes:

```
equipment/
    api
    application
    domain
    infrastructure
```

**If one new feature requires modifying multiple existing modules, the
architecture should be reviewed.**

## Golden Rules

1. Business logic belongs in the Domain.
2. Controllers stay thin.
3. Repositories only access data.
4. Modules communicate via events.
5. Infrastructure is replaceable.
6. Never expose Entities.
7. Every feature follows the same module structure.
8. Stateless application.
9. Feature-first package organisation.
10. New functionality **extends** the system instead of modifying existing modules.

---

## Long-Term Vision

Fotolio is not a collection of CRUD APIs. The backend should evolve into a
business platform supporting: CRM · Booking Management · Payments · Portfolio ·
Instagram Automation · Studio Management · Marketplace · Learning Platform · AI
Services · Reports & Analytics · Maps · Equipment Library · Workshops · Team
Management.

The architecture must allow these to be added **incrementally, without
structural rewrites** — every new feature integrating naturally by following the
principles in this document.
