# 002 — Modular monolith, module-extraction triggers, and where serverless fits

**Status:** Accepted (2026-07-26) · **Enforced.**
**Related:** `docs/BACKEND_FOUNDATION.md` (the standard), `docs/DEVELOPMENT_PLAN.md`
§"Backend module standard", `docs/VISION_AND_EXTENSIBILITY.md`

> This ADR records *why* the backend is one deployable unit, the concrete signal
> that would justify splitting a module out, and why serverless is reserved for
> the edges. It exists so the answer to "should this new thing be a microservice
> / a Lambda?" is written down once instead of re-argued per feature.

---

## 1. Context

The platform is early and built largely by a small team. The owner's vision
(see `VISION_AND_EXTENSIBILITY.md`) is broad — CRM, payments, galleries,
Instagram automation, a marketplace, a learning platform — so the architecture
has to stay **extensible for years without rewrites**, which is a real concern,
not premature optimisation.

The tempting-but-wrong instinct at this size is to reach for microservices
because the *domain* is large. But the team and traffic are not. Microservices
would buy distributed transactions, network failure modes, service discovery,
per-service deploys, duplicated infra and multi-service debugging — all paid
now, for scale that does not yet exist.

The considered options:

- **Distributed / spaghetti monolith** — no module boundaries. Fast for a
  weekend MVP, unmanageable within a year. Already ruled out: the code is
  feature-partitioned into 16 modules.
- **Microservices** — right for large teams needing independent deploy/scale;
  wrong for this team size and stage.
- **SOA + ESB** — heavyweight enterprise integration; wrong scale.
- **Serverless / FaaS for the whole app** — does not fit a stateful
  Spring Boot app with per-transaction tenant binding and long-lived
  JPA/connection pools.
- **Modular monolith** — one deploy, one database, clear in-process module
  boundaries, with the *option* to extract a module later without rewriting its
  business logic.

## 2. Decision

**The backend is a modular monolith, and stays one until a specific module earns
its own deployment.** Boundaries are treated as real even though everything runs
in one process: repositories are module-private, cross-module communication goes
through a service/facade or a domain event, and a shared kernel
(`common · auth · tenant · audit · notification · entitlement`) is the only thing
every module may depend on.

These boundaries are **machine-enforced** by `ArchitectureTest` (ArchUnit) with a
frozen baseline that can only shrink — see `BACKEND_FOUNDATION.md`
§"Enforced Boundaries". Enforcement is what makes "extract later without a
rewrite" a real option rather than a hope.

## 3. When to extract a module into its own service

Extract **only** when a module exhibits a concrete, measured pressure that a
separate deployment actually relieves — not because the domain "feels big":

- **Independent scaling.** The module's load profile diverges sharply from the
  rest (e.g. image/gallery processing saturating CPU while the API is idle) and
  vertical scaling of the monolith is wasteful.
- **Independent deploy cadence / blast radius.** The module changes far more
  often, or its failures must not be able to take down bookings/payments.
- **Independent runtime or data store.** It genuinely needs a different language,
  a specialised datastore, or an isolation/compliance boundary.
- **Team topology.** A dedicated team owns it end-to-end and monolith merge
  contention is a real drag.

If none of these is true and measurable, **do not extract.** A clean in-process
module is cheaper and faster than a service in every dimension that matters here.

Because boundaries are already enforced, the extraction path is mechanical: the
module already talks to others only via a facade or events, so those calls become
the network/queue seam; its private repository and schema travel with it.

## 4. Where serverless / FaaS fits

Serverless is a **complement at the edges, never the core**. Good fits:

- Bursty, stateless, event-triggered work that would otherwise steal capacity
  from the request path: image/thumbnail derivation, video transcode, ZIP export
  of a delivered gallery, bulk email fan-out.
- Scheduled/glue jobs where paying-per-invocation beats a running server.

Explicit non-goals: the request-serving core, anything inside a tenant DB
transaction, and anything needing the JPA/session/tenant context. Those stay in
the monolith. When edge work is extracted, it is triggered by the same domain
events (§`BACKEND_FOUNDATION.md` Event-Driven) and reached through an adapter, so
the core stays unaware of the runtime on the other side.

## 5. Consequences

- **Positive:** one simple deploy and one database today; enforced boundaries
  keep coupling from rotting; each future feature is a new module that *extends*
  rather than *modifies*; extraction and edge-serverless remain open without a
  rewrite.
- **Cost accepted:** the whole app scales as a unit until a module earns
  extraction; a single process is a shared failure domain (mitigated by
  statelessness + horizontal replicas); the discipline only holds because
  ArchUnit fails the build when it is broken — so the baseline must be kept
  shrinking, never grown.
- **Revisit when:** any §3 trigger becomes measurably true for a specific
  module — at which point this ADR is superseded by a module-specific extraction
  ADR.
