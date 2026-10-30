# 003 — Community: a second, cross-tenant data domain

**Status:** Accepted (2026-09-05) · **Not yet implemented** — no community
feature exists. This is the decision the first one must be built against.
**Related:** `docs/VISION_AND_EXTENSIBILITY.md` §4 (the six ideas),
`docs/adr/002-modular-monolith-and-scaling.md` (module boundaries),
`V11__tenant_rls.sql` (how isolation actually works), `docs/PRICING.md` §6.3

> **Read this before building the locations map, the studio marketplace,
> coaching, or workshops.** Four of the six roadmap ideas are cross-tenant by
> definition, and the isolation model has no sanctioned way to read across
> tenants. Whoever needs it first will otherwise reach around Row-Level
> Security in a feature branch — which is a tenant-isolation hole and an
> architectural fork in the same commit.

---

## 1. Context

### What isolation is today

`V11__tenant_rls.sql` replaced schema-per-tenant with **Row-Level Security**.
Every tenant-scoped table lives in `public` with a `tenant_id` column and an RLS
policy; `TenantRoutingDataSource` issues
`set_config('app.tenant_id', ?, true)` as the first statement of each
transaction, and the policy compares against that GUC. The app connects as
`fotolio_app`, a role the policies bind.

The important property: **a query cannot see another tenant's rows even if the
Java code forgets to filter.** That is the whole isolation story, and it is a
good one.

### What the roadmap asks for

Four of the six ideas in `VISION_AND_EXTENSIBILITY.md` §4 are *third person* —
they show a photographer what **other** tenants have:

| Idea | The cross-tenant read it needs |
|---|---|
| Locations map | every published spot, from every tenant, near a point |
| Studio marketplace | every listed studio, filtered by city and date |
| Coaching | every published coach and offer |
| Workshops | every published workshop |

Instagram automation needs none of this (it is only ever your own account), and
the gear guide needs none either (it is editorial content with no owner).
**Those two are unaffected by this ADR and can ship without it.**

### The gap

There is no supported way to run those queries. RLS is doing exactly what it was
built to do, and the feature is asking for the one thing it forbids. The
tempting workarounds are all bad:

- **Set `app.tenant_id` in a loop** — N queries for one map, and the loop needs
  a list of every tenant, which is itself a cross-tenant read.
- **Query as the owner/migration role** — bypasses RLS for the whole
  transaction, so one bug in a community endpoint leaks private booking data.
- **Drop RLS on the tables that need to be shared** — silently converts an
  isolation guarantee into an application-level convention, and nothing tells
  the next developer which tables are which.

## 2. Decision

**Community data is a separate data domain, not a relaxation of the existing
one.** Concretely:

1. **Its tables are platform-scoped and carry no RLS tenant policy.** They live
   in `public` alongside the tenant-scoped tables but are a different *kind* of
   table: shared by construction, like `tenants` itself.

2. **`owner_tenant_id` is an attribute, not a boundary.** It records who
   contributed a spot or listed a studio — used for attribution, for "my
   contributions" views, and for authorisation on **writes**. It is never the
   thing that keeps a reader out, because the entire point is that readers see
   other tenants' rows.

3. **Only published, deliberately-shared facts may live there.** A studio's
   listing, a scouted location, a workshop's description and price. Never a
   booking, a client, a lead, a gallery, an invoice, or anything derived from
   them. A field that a photographer did not knowingly publish to other
   photographers does not belong in this domain.

4. **Writes are authorised in the service layer, per row.** With no RLS
   backstop, `owner_tenant_id == TenantContext.current()` is a check the
   service must make on every update and delete. This is the cost of the
   decision and it is why §3's boundary rules are not optional.

5. **Backed by a `community` module** with the standard shape
   (`controller · domain · dto · repository · service`), whose repositories are
   module-private exactly like every other module's (ADR-002). Feature modules
   reach it through its service, never its repositories.

6. **Routed under `/community/*` on the web and `/api/community/*` on the API,
   from the first feature.** Retro-fitting a prefix breaks every saved link.

## 3. Enforcement

`ArchitectureTest#communityRepositoriesAreModulePrivate` fails the build if
anything outside `..api.community..` touches a community repository. It passes
vacuously today (the package does not exist) and starts biting the day it does —
which is the point: the guardrail predates the code it guards.

The one thing a test cannot catch is a tenant-scoped column being copied into a
community table. That is a review question, and §2.3 is the rule to review
against.

## 4. Consequences

**Good.** The isolation model stays intact and stays simple — one rule for
tenant data, one rule for shared data, and which is which is visible from the
table's own definition. Community features get plain, single-query reads. The
`community` module can be extracted later on ADR-002's terms like any other.

**Bad.** Two kinds of table in one schema is a thing every developer must now
know. Write authorisation for community rows is hand-written and therefore
fallible, where tenant data gets it for free.

**Accepted risk.** A bug in a community *write* path can let one tenant edit
another's listing. That is bounded — the data is public by construction, so the
worst case is vandalism rather than disclosure — and it is why writes are
concentrated in one module rather than spread across features.

## 5. A capability is not an offering

The marketplace introduces a second kind of "can do this", and the two must not
share a name.

- **`Capability`** (`entitlement.domain.Capability`) is what the **plan grants**.
  It is resolved from `app.plans.tiers[].capabilities` in `application.yml`,
  served by `GET /api/entitlements`, and mirrored for presentation in
  `plan-gate.ts`. Its Javadoc is the contract: *the boolean, plan-gated
  features*.

- **A tenant offering** is what the studio **declares about itself** — "we also
  rent out our space", "we teach". It is not bought and no tier grants it.

Folding an offering into `Capability` would break the `plan → capabilities`
invariant and make `/api/entitlements` mean two different things at once, which
is how `if (plan === 'PRO')` sprawl returns wearing a new name. So:

**When the first offering feature lands, add a separate `TenantOffering` enum
and a column on `tenants` — do not extend `Capability`.** A nav row then
composes the two: the *offering* decides whether the row is relevant to this
studio, the *capability* decides whether the plan allows it.

`EntitlementServiceTest#everyCapabilityIsGrantedBySomeTier` enforces the half
that is checkable today: a value in `Capability` that no tier grants is, by
definition, not plan-gated, and the build says so.

**A separate `STUDIO` role is not the answer either.** A photographer who also
rents out their space would need two accounts and two logins — a reason to leave
rather than a feature. `StaffRole` already treats PHOTOGRAPHER and ADMIN as one
thing for the same reason: roles are expensive to add and hard to remove. A pure
rental business that never shoots can have a role when one actually signs up.

## 6. Money changes shape

Until the marketplace, every euro moves **client → photographer**. From studio
rental onward it also moves **photographer → photographer**, and that is a
different transaction in three ways:

- The counterparty is a business, not a consumer — VAT treatment differs, and
  `Invoice.tax_mode` (`KLEINUNTERNEHMER` / `REGULAR`) was chosen for the
  consumer case.
- The platform takes a fee on it, so `Payment.application_fee_cents` is
  non-zero for a reason unrelated to the Starter commission.
- `AnalyticsService` sums **issued invoices** into one figure called *revenue*.
  Two unrelated businesses summed into one number answer neither question.

**Decision: tag the source now, while there is only one.** `invoices.source` and
`payments.source` default to `CLIENT_BOOKING` and are set explicitly at every
creation site. Recording it today is a column; splitting the figure after both
sources exist is a migration over data that no longer says where it came from.

**Deliberately deferred:** whether a marketplace transaction produces an
`Invoice` in the same per-tenant, per-year sequence at all. §14 UStG requires
the number to be unique and sequential, which one series satisfies — but the
issuer, the tax treatment and the document template all differ. That question is
answered when studio rental is designed, not now; the `source` column is what
makes either answer implementable.

## 7. Related

- `docs/VISION_AND_EXTENSIBILITY.md` §4 — the six ideas and what each needs
- `apps/api/.../common/config/TenantRoutingDataSource.java` — how the GUC is set
- `apps/api/src/main/resources/db/migration/V11__tenant_rls.sql` — the policies
- `apps/web/src/lib/nav.ts` — the nav model a community group/mode plugs into
