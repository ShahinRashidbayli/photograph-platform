# Vision & Extensibility Analysis

> Analysis of the platform owner's future vision (training, maps, workshops,
> equipment guides, Instagram growth, studio marketplace) against the current
> architecture — and what the codebase needs before any of it can be built.
> Companion to [`ROADMAP.md`](ROADMAP.md) (product scope) and
> [`PRICING.md`](PRICING.md) (plan tiers & payments).
>
> **Bottom line:** the architecture is genuinely extensible. Almost none of the
> vision needs a rewrite. But 5 of the 6 future ideas — and the plan-gating the
> owner wants — all sit on **two keystones that do not exist yet**: an
> **entitlement layer** (`plan → capabilities`) and a **payment/payout
> infrastructure** (Stripe Connect). Build those two, then the features clip on.

---

## 1. Is the platform extensible? Yes.

### Backend — feature-modular monolith ✅

`apps/api/src/main/java/com/photographplatform/api/` is 13 self-contained
feature modules, each with the same internal shape:

```
{feature}/ ── controller · domain · dto · repository · service
```

Modules today: `audit, auth, booking, client, gallery, inquiry, lead,
notification, photo, portfolio, pricing, tenant, user` (+ `common`).

Adding a feature = adding a package with the same five parts. This is the
strongest property of the codebase.

Multi-tenancy is **Row-Level Security**, not schema-per-tenant — `V11` replaced
the schemas with a `tenant_id` column plus an `app.tenant_id` GUC set per
transaction (`TenantRoutingDataSource`). That matters for the vision: it means
every query is scoped to one tenant, so the four **cross-tenant** ideas below
(map, studio marketplace, coaching, workshops) need a decision RLS does not
provide on its own. See [`adr/003-community-cross-tenant-data.md`](adr/003-community-cross-tenant-data.md)
— it is the precondition for #1, #2, #3 and #6. Ideas #4 and #5 are unaffected.

### Frontend — Next.js app-router ✅

Route groups (`(dashboard)`, `(auth)`) + public routes (`p/`, `g/`, `r/`).
Adding a page = a route + a sidebar entry in
`apps/web/src/app/(dashboard)/layout.tsx`. Extensible.

### The gap — no entitlement layer ❌ (the keystone)

`Tenant.plan` is a plain `String`, read in 4 places and only copied into
response DTOs. **Nothing branches on it.** Per [`PRICING.md`](PRICING.md) §1:
*"a STARTER tenant can use every feature of PRO and STUDIO today. The plans are
decoration."*

Every plan-gated idea below depends on fixing this first. See
[`PRICING.md`](PRICING.md) §6.3 — one place that maps `plan → capabilities`,
read by **both** API and UI, enforced **server-side**.

---

## 2. The two keystones everything hangs on

| Keystone | Why it blocks the vision | Status |
|---|---|---|
| **Entitlement** (`plan → capabilities`) | Training, workshops, studio tools, Studio-tier reports, "show feature but require upgrade" — all are per-plan gates. Without a central map each gate becomes a scattered `if (plan === 'PRO')`. | ❌ Not built |
| **Payments / payouts** (Stripe Connect Express) | Training sales, workshop sales, studio rental, deposit collection, the Starter commission — all move money to a third party. No `Invoice`/`Payment`/`Subscription`/Stripe entity exists in the backend at all. | ❌ Not built. Architecture **decided**: Connect Express ([`PRICING.md`](PRICING.md) §4) |

**Reframing:** the owner is not building 6 separate features. They are building
**2 foundations**, after which the features are comparatively small. The
platform's modularity is exactly what makes that clip-on model work.

---

## 3. Immediate feedback — status

| # | Ask | Verdict | Notes |
|---|-----|---------|-------|
| 1 | Leads before Bookings in the sidebar | ✅ **Done** | Reordered in `layout.tsx`; matches the Instagram-first flow (triage enquiries first). |
| 2 | Bookings/Leads/Clients share styling for consistency | ⚠️ **Real debt** | These pages (1403 / 544 / 643 lines) share **no** page-level component — `components/ui/` and `components/layout/` are empty. Same list/card/header/status-pill pattern is hand-written 3×. Fix: extract `PageHeader · DataList · Card · StatusPill · FilterBar · EmptyState`. |
| 3 | Photographer Payments tab (invoices, track payments) | ✅ **Tab added (stub)** | Tab now in photographer nav with a "Soon" badge; `/payments` is role-aware — photographer sees a money-hub preview, not the client bill-paying screen. Real page needs keystone #2. |
| 4 | Plan-dependent tabs (e.g. Studio "Revenue & reports") | ⏳ **Needs entitlement** | `reports` + `revenue` stubs already exist; gating them by plan needs keystone #1. |
| 5 | Don't hide gated tabs — show them + "requires upgrade" | ✅ **Right call, mechanism exists** | `ComingSoon` badge + `soon: true` already does show-but-mark. Extend to `requiresPlan: 'STUDIO'`. Enforcement must be server-side. |
| 6 | Is BE/FE extensible for future features? | ✅ **Yes** | See §1. |

---

## 4. Future vision — feasibility

None of these require an architectural change. The "Needs" column is what's
missing today.

| # | Idea | Possible today? | Needs |
|---|------|:---:|-------|
| 1 | **Training** — experienced photographers sell coaching to newcomers | Arch ✅ / feature ❌ | new `training` module · entitlement (who can sell) · payments/payout · content hosting |
| 2 | **Map integration** — photographers share scouted locations & angles | Arch ✅ / feature ❌ | new `location` module (geo data) · FE map component · UGC moderation. **Most original differentiator — no competitor has it.** |
| 3 | **Workshops / paid video lessons** by seniors | Arch ✅ / feature ❌ | `course`/`workshop` module · payments/payout · video storage (R2 exists). Shares infra with #1. |
| 4 | **Equipment / technique guide** — help beginners pick gear | Arch ✅ / feature ❌ | `guide` content module. Simplest — pure content, no money flow. Closest to MVP-able. |
| 5 | **Instagram growth** — auto-post, story/reels stickers, strategy | Partly ✅ | Already in [`ROADMAP.md`](ROADMAP.md) §4.5 (DM webhook, bio-link, story/post stickers = v2.0). `InquiryRequest` + `source=INSTAGRAM` already modelled. **It is Pro's anchor** ([`PRICING.md`](PRICING.md)). |
| 6 | **Studio marketplace** — studios list space, photographers search & book | Arch ✅ / feature ❌ | new `STUDIO` role · `studio` module · search/matching · reuse `booking` module · payments. Biggest, but highest revenue potential. |

**5 of 6 depend on the two keystones in §2.** #4 (equipment guide) is the one
that could ship independently, since it moves no money and needs no gate.

---

## 5. Recommended build order

**Phase 0 — cheap wins (done):**
- Leads → Bookings nav reorder (#1)
- Photographer Payments stub tab (#3)

**Phase 1 — keystone + consistency (unblocks everything):**
- **Entitlement layer** — `plan → capabilities`, API + UI, server-enforced (#4, #5, and the base of the whole vision)
- **Shared FE component system** — `PageHeader / DataList / Card / StatusPill` (#2, and every page added after)

**Phase 2 — money:**
- **Stripe Connect** onboarding (KYC, `account.updated`, "finish payout setup" UI)
- **Payments / Invoices** page + `Invoice`/`Payment` model (#3 real, base of vision #1/#3/#6)

**Phase 3 — features, in impact order:**
- Instagram (#5, Pro anchor — already sold, must ship)
- Map (vision #2 — the differentiator)
- Studio role + marketplace (vision #6)
- Training / Workshops (vision #1, #3)
- Equipment guide (vision #4 — can slot in any time; needs no keystone)

---

## 6. Related

- [`ROADMAP.md`](ROADMAP.md) — product scope; §4.5 is the Instagram flow (vision #5)
- [`PRICING.md`](PRICING.md) — plan tiers (§3), commission + Stripe Connect (§4), entitlement layer (§6.3)
- `apps/web/src/app/(dashboard)/layout.tsx` — sidebar nav (feedback #1, #3, #5)
- `apps/api/.../tenant/domain/Tenant.java` — where `plan` lives (keystone #1)
