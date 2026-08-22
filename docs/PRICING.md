# Pricing & Plans

> **STATUS: DRAFT — one decision locked, the rest still proposals.**
>
> | | |
> |---|---|
> | ✅ **Decided 2026-07-17** | Payments use a **commission on Starter**, not a Pro paywall (§4). This forces Stripe Connect as the payment architecture. |
> | ✅ **Decided 2026-07-17** | **Instagram DM automation is Pro's anchor** (§3, §7.5). Now live on the landing page. |
> | ✅ **Decided 2026-07-17** | **Commission rate = 2%** on Starter (§4, §7.1). Break-even ≈ €1,000/mo collected. |
> | ✅ **Decided 2026-07-17** | **Gallery retention is the value metric, not gigabytes**: Starter 60 days · Pro 1 year · Studio 2 years (§4b). GB survives only as an unadvertised fair-use cap. |
> | ⏳ Open | §7.2–§7.3 and §7.6–§7.9. |
>
> Nothing here is implemented. This document exists because the plan tiers were
> never actually decided: the only "spec" today is a hardcoded array on the
> landing page, and `ROADMAP.md` does not mention pricing at all.
>
> As §7 is answered this file becomes the canonical source for what each plan
> includes — and the landing page must be generated from, or at minimum
> reconciled with, it. Until then, treat every number and every feature
> placement below as a proposal to argue with.

---

## 1. Where we actually are today

The three plan names exist end to end, but **nothing enforces them**.

| Layer | Reality |
|---|---|
| Database | `tenants.plan VARCHAR(20) NOT NULL DEFAULT 'STARTER'`, `CHECK (plan IN ('STARTER','PRO','STUDIO'))` |
| Backend | **Superseded 2026-08-22.** `Plan` is an enum, and `EntitlementService` is the single place that maps a plan to what it grants — retention window, seats, capabilities and the commission rate. Gates throw (`PlanUpgradeRequiredException` → 402) rather than returning booleans, and `WriteAccessInterceptor` covers every mutating endpoint by default. |
| Frontend | Rendered as a badge in the sidebar and Settings. Never used to gate a feature. |
| Landing | `PRICING` array in `apps/web/src/app/page.tsx` — €19 / €39 / €79 (yearly €16 / €32 / €65) |
| Billing (ours) | **Built 2026-08-22.** 14-day trial stamped at registration, read-only lock when it lapses (§7.7), Stripe Checkout to subscribe and Stripe's hosted portal to manage. The tenant's plan comes from the price on the confirmed subscription. Needs Stripe price ids and a second webhook endpoint configured before it can sell anything. |
| Billing (theirs) | **Built.** Photographers issue §14 UStG invoices per booking, clients pay them by card / SEPA / bank transfer, and the DATEV export covers the year. Money moves on Stripe Connect (Express) — direct charges on the photographer's own connected account, with our commission taken off the top. |

~~**Consequence: a STARTER tenant can use every feature of PRO and STUDIO
today.**~~ No longer true as of 2026-08-22 for anything that has been built:
retention is enforced per plan, and the capability gates exist and are wired.
It remains trivially true for the features that do not exist yet (Instagram
automation, contracts, analytics, seats) — nothing gates what nothing does.

### What the landing page sells vs. what is built

Reconciled with §4/§4b/§5 on 2026-07-17. Payments (§4) shipped on 2026-08-18 on
Stripe Connect Express; the two rows below moved to ✅ and the landing page's
"soon" badges on them should come off.

| Plan | Feature | Built? |
|---|---|---|
| Starter | Portfolio & website | ✅ |
| Starter | Lead management | ✅ |
| Starter | Online bookings | ✅ |
| Starter | Client management | ✅ |
| Starter | Stripe deposits* | ✅ card + SEPA on Connect Express, with the 2% commission (§4) |
| Starter | Galleries online 60 days | ✅ shipped 2026-08-22 — set at delivery from the plan, warned, expired and purged by the retention job (ADR-001) |
| Pro | Everything in Starter | — |
| Pro | Instagram DM automation | ❌ "soon" — the anchor we now sell (§7.5) |
| Pro | 0% commission | ✅ `app.stripe.commission.pro-bps: 0` — the fee is simply not sent |
| Pro | Contracts & e-sign | ❌ "soon" |
| Pro | Galleries online 1 year | ✅ shipped 2026-08-22 (ADR-001) |
| Studio | Everything in Pro | — |
| Studio | Up to 3 photographers | ❌ no multi-user support exists |
| Studio | Analytics & reports | ❌ `/reports` and `/revenue` are stubs |
| Studio | White-label branding | ❌ |
| Studio | Galleries online 2 years | ✅ shipped 2026-08-22 (ADR-001) |

**Pro's 0% commission is now the only built difference from Starter.** It is
also the one §4 called the real conversion trigger, so the tier is no longer
purely announced — but everything else that separates Pro or Studio (Instagram
DM automation, contracts, retention windows, multi-user, analytics) is still
unbuilt and still carries a "soon" badge.

---

## 2. Principle: price the customer's revenue, not the feature count

A photographer does not compare €19 to €39. They compare €39 to **the €1,200
wedding deposit the platform collected for them that month**. Every gate should
therefore sit on an axis that grows with the customer's own success, so the
upgrade is arithmetic rather than persuasion.

Two consequences:

- **Do not gate table stakes.** Anything a photographer needs to run their first
  booking must be in Starter. Gating it does not create upgrades; it creates
  churn before the customer ever sees the value.
- **Gate where money moves.** Payments, contracts, and lead volume are where the
  customer's revenue is visible — that is where a price step is defensible.

---

## 3. Proposed tiers

### Starter — €19/mo · "Get online"

Goal: move the business onto the platform and land the first booking.

- Portfolio & public booking page
- Lead management & scoring
- Bookings & calendar
- Client list / CRM ← **moved down from Pro** (see §5)
- Galleries — online for 60 days (§4b)
- Stripe deposits — **enabled, with a commission** (§4). Starter can take money
  from day one; that is the point.

### Pro — €39/mo · "Get paid" ← the real conversion

Upgrade trigger: *"I want to take deposits without paying a cut."*

- Everything in Starter
- **Instagram DM automation** — the anchor. `ROADMAP.md` §4.5 calls it the
  platform's most critical flow, and no competitor has it; it is the strongest
  thing we have to sell. **Decided 2026-07-17** and now on the landing page.
- **0% commission** — keep 100% of what you collect. Past the break-even volume
  in §4 this alone pays for the plan.
- Contracts & e-sign — legally binding signatures matter in the German market
- **Galleries online 1 year** vs Starter's 60 days (§4b)
- GoBD-konforme invoices — *proposed, not on the page yet*
- Unlimited bookings — *proposed, not on the page yet*

### Studio — €79/mo · "Team & brand"

Upgrade trigger: *"I hired a second photographer."*

- Everything in Pro
- **Galleries online 2 years** (§4b)
- Up to 3 photographers (seats)
- Own domain / white-label
- Analytics & reports
- Priority support

---

## 4. Payments: commission, not a gate — **DECIDED 2026-07-17**

Payments are **not** locked behind Pro. Every plan can take deposits; Starter
pays a commission on what it collects, Pro and Studio do not.

| Plan | Fotolio fee on collected payments |
|---|---|
| Starter | **2%**, on top of Stripe's own fee |
| Pro / Studio | 0% |

**Why.** A Starter user who cannot take a deposit never experiences the core
value, so they never convert — they leave before the paywall can work. With a
commission the upgrade sells itself: past a certain monthly volume, the
commission exceeds the €20 price gap and Pro is simply the cheaper option. The
customer upgrades because of arithmetic, and the low-volume user stays instead
of bouncing.

### Where the upgrade actually triggers

The rate is not cosmetic — it *is* the upgrade trigger. Pro costs €20/mo more
than Starter, so the break-even is `€20 ÷ rate`:

| Starter rate | Pro becomes cheaper at | Reads as |
|---|---|---|
| 1% | €2,000/mo collected | Upgrade is a milestone; Starter stays viable longer |
| **2% ← chosen** | **€1,000/mo collected** | One wedding deposit can cross it — fast conversion |
| 3% | €667/mo collected | Most active photographers upgrade almost immediately |

**2% is the decision (2026-07-17).** A part-time photographer doing one €400
shoot a month pays €8 and stays on Starter happily; a full-time wedding
photographer crosses €1,000/mo almost immediately and Pro pays for itself. Note
the customer's *total* cost at Starter is ~3.5% once Stripe's own ~1.5% is
added — §4.2 below.

### Mechanism: Stripe Connect (Express) — this is not optional

Taking a cut of someone else's payment has exactly one sane implementation:

- **Stripe Connect Express.** The photographer gets their own (Stripe-hosted,
  KYC'd) account; funds go to them; Fotolio takes `application_fee_amount` per
  charge. Stripe handles payouts and compliance.
- **The alternative — money landing in Fotolio's account and us paying
  photographers out — makes Fotolio a payment facilitator.** In the EU that is a
  regulated activity (BaFin). It is not on the table.

Consequences to accept now, before writing any payment code:

1. **Onboarding gains a step.** A photographer cannot accept money until they
   finish Stripe's KYC. That is a new funnel stage with real drop-off, and it
   must be surfaced in the UI ("Finish payout setup to accept deposits"), not
   discovered at the first failed charge.
2. **Total cost to the Starter photographer** is Stripe's EU card fee
   (~1.5% + €0.25) **plus** our rate. At 2% on a €480 deposit that is ~€17 — this
   is what they will compare against Pro, so it must be shown honestly.
3. **The commission must be disclosed in the AGB**, which are still placeholder
   drafts (see the legal pages issue). Legal sign-off is a launch blocker for
   charging a commission, not a detail.
4. **Build payments on Connect from day one.** Plain Checkout first and Connect
   later would be rework of the entire payment path. Since Stripe is not built
   *at all* yet, this decision costs nothing today — it only saves a migration.
   Deciding this now, before the code exists, is the whole value of deciding it.

---

## 4b. Gallery retention — the second value metric — **DECIDED 2026-07-17**

| Plan | Gallery stays online |
|---|---|
| Starter | **60 days** |
| Pro | **1 year** |
| Studio | **2 years** |

**Why time and not gigabytes.** Storage *is* production × retention, so a time
window already prices the space — and it prices it in a unit the customer can
actually reason about. A photographer cannot estimate their gigabytes, but they
know exactly what *"my client came back eight months later asking for the
photos"* feels like. That makes retention both the honest cost metric (R2 bills
GB × time) and the emotional one.

It also fixes a real problem: with a 60-day window, storage stops being
cumulative and collapses to the current window. Nobody would ever have hit the
GB tiers we briefly advertised:

| | Produced per year | Held in a 60-day window (peak season) |
|---|---|---|
| Part-time | ~18 GB | ~4 GB |
| Full-time wedding | ~104 GB | ~29 GB |
| Studio (3 photographers) | ~312 GB | ~86 GB |

So gigabytes could never have driven an upgrade. Retention can: **60 days is
exactly what makes Pro's year worth €20/month.**

### Non-negotiable before any gallery is deleted

Deleting a client's wedding photos is the most destructive thing this product
will ever do, and the failure lands on the photographer's reputation — not ours.
**Four requirements gate the expiry job; they live in
[`adr/001-gallery-retention-and-deletion.md`](adr/001-gallery-retention-and-deletion.md) §4**,
which is where an engineer implementing it will actually look:

1. Reminder emails to the **client** (~day 45 / 55 / 59) — the dashboard
   countdown is not enough; a client who never opens it sees nothing.
2. The photographer can **extend** a gallery.
3. **Soft-delete then hard-delete** — a margin for our own bugs.
4. **AGB states "delivery platform, not archive"** before the first deletion.

None of them exist yet.

DSGVO note: automatic deletion is data minimisation and a genuine selling point
in the German market — worth stating in the Datenschutzerklärung rather than
hiding as a limitation.

### Current state

`galleries.expires_at` **already exists** in the tenant schema (nullable, never
set) and the dashboard already reads it. So the model anticipated this; what is
missing is the value on write, the expiry job, and the emails above.

---

## 5. What must NOT be gated

**CRM / client management → move to Starter.** `/clients` already works and is
open to everyone. A client list is not a growth feature; it is the minimum for
running a photography business. Gating it now would also be a visible takeaway
from existing users.

**"Bilingual DE / EN support" → remove or rename.** As written this is
ambiguous, and if it means the UI language toggle it cannot be sold at all: it
is an app-wide preference (`apps/web/src/lib/i18n`), not a per-tenant
capability. Disabling German for a Starter tenant is neither technically
sensible nor defensible to a German customer. If the intent was *customer
support in two languages*, say that explicitly and move it to Studio, where
priority support already lives.

---

## 6. Implementation order

Deliberately, more features are **not** the next step:

1. ~~**Fix the pricing table to match §4/§4b/§5.**~~ ✅ **Done 2026-07-17.**
   Stripe deposits and CRM moved to Starter, the bilingual line removed, Pro
   sells the Instagram anchor + "no transaction fee", and gigabytes were
   replaced by retention. Copy was rewritten for a first-time visitor — no
   internal jargon ("lead", "portfolio & website") — and kept terse, because a
   wrapped label breaks the row's check-icon alignment; the 2% is stated in the
   label with the footnote adding that it sits on top of Stripe's fee.
   The CTA now carries the chosen plan (`/register?plan=…`) and the register
   page confirms it — previously all three cards landed on the same page and
   every signup silently became STARTER.
2. **Answer the rest of §7 and freeze this document.**
3. ~~**Entitlement layer.**~~ ✅ **Done 2026-08-22.** `EntitlementService` maps
   `plan → capabilities` in one place, serves the same resolved object to the
   UI at `GET /api/entitlements`, and gates server-side by throwing rather than
   returning a boolean a caller can forget to check. The commission rate is
   folded in as an entitlement, as this line asked; it stays *configured* under
   `app.stripe.commission` where the deploy docs already point at it.
4. **Stripe Connect onboarding.** Express accounts, KYC, `account.updated`
   webhooks, and the "finish payout setup" state in the UI. This is the
   prerequisite for any payment at all — see §4.
5. **Payments with `application_fee_amount`** derived from the tenant's plan.
6. ~~**Billing.**~~ ✅ **Done 2026-08-22.** Stripe Checkout (subscription mode)
   for the initial purchase, Stripe's hosted billing portal for everything
   after it — card changes, invoices, plan switches, proration and cancellation
   are Stripe's regulated surface, and every screen we did not build is a
   screen that cannot disagree with what Stripe actually charged.

   The plan is written by the subscription webhook from the price on the
   confirmed subscription, and nowhere else — an abandoned checkout upgrades
   nobody. Subscribing mid-trial passes the remaining trial to Stripe as
   `trial_end`, so nobody pays twice for the same fortnight.

   **Operationally this needs its own Stripe webhook endpoint and its own
   signing secret** (`/api/public/webhooks/stripe/billing`), separate from the
   Connect one — see `infra/.env.example`. Price ids are all-six-or-none: the
   app refuses to boot half-configured.

Enforcement must be server-side. A UI-only gate is a suggestion, not a limit —
and with a commission the stakes are money, not just a locked screen: the fee
has to be computed on the server from the tenant's plan, never sent by the
client.

---

## 7. Open questions

Struck-through items are decided; they stay for the reasoning trail.

1. ~~**Commission or hard gate on payments?**~~ → **commission, 2026-07-17** (§4).
2. ~~**What is the commission rate?**~~ → **2%, 2026-07-17** (§4). Break-even
   ≈ €1,000/mo collected.
3. ~~**Is the 10 GB Starter storage cap real?**~~ → **superseded by §4b**:
   gigabytes are not sold at all. Retention is the metric; GB survives only as
   an unadvertised fair-use cap (Starter 50 GB · Pro 250 GB · Studio 1 TB),
   sized well above each tier's realistic peak so it never binds an honest user.
4. ~~**Should Instagram DM automation be the Pro anchor?**~~ → **yes,
   2026-07-17.** It is on the page, which raises the stakes on `ROADMAP.md` §4.5:
   the feature is now *sold*, so it has to ship.

**Still open:**

5. **Is Stripe Connect's onboarding friction acceptable?** Mandatory for the
   commission model (§4); it puts a KYC step before a photographer's first euro.
   If that is too costly for launch, revisit the §4 decision — not the mechanism.
6. **Are the prices right for the German market?** €19/mo = €228/yr. A part-time
   photographer shooting 10–15 times a year may not clear that bar; is Starter
   meant for them at all, or is there a free/€9 tier below it?
7. ~~**What happens when the trial ends?**~~ → **read-only lock, 2026-08-22.**
   Writes stop; reads, delivered galleries and *client payments* keep working.
   Suspending would also cut off a couple holding a gallery link who are not
   party to the photographer's billing, and blocking client payments would stop
   money coming in from the very account we are trying to collect from.
8. ~~**Do existing tenants get grandfathered** when gates land?~~ → **yes,
   generously, 2026-08-22.** V20 gives every existing tenant a full 14-day trial
   measured from the migration rather than from their signup, and V22 gives
   every existing gallery a full retention window measured from the migration
   rather than from its delivery. Backdating either would have locked working
   accounts out — or deleted live galleries — on deploy day, against a deadline
   nobody was ever shown.
9. **Should a photographer's plan be public?** `GET /api/public/portfolio/{subdomain}`
   returns `plan` inside `PhotographerPublic`, so anyone can see which tier a
   photographer pays for. Nothing in the frontend reads it. Either it was a
   deliberate badge idea worth stating, or it is an unintended leak of billing
   information and should leave the DTO.
10. **What happens at the fair-use cap?** Block uploads, or bill overage? Only
    affects outliers, but undefined.
11. ~~**Gallery retention needs a retention policy of its own**~~ → **built
    2026-08-22.** Reminder emails to the client (15/5/1 days before), a
    photographer-side extend that also recovers an already-expired gallery, and
    a 30-day soft-delete grace period — see ADR-001 §4. The destructive phase
    remains off by default pending legal review of the AGB wording.

---

## 8. Related

- `docs/ROADMAP.md` — product scope; §4.5 covers the Instagram flow referenced above
- `apps/web/src/app/page.tsx` — the `PRICING` array that currently acts as the spec
- `apps/api/.../tenant/domain/Tenant.java` — where `plan` lives
- `apps/api/src/main/resources/db/migration/V1__create_tenants.sql` — the `CHECK` constraint
