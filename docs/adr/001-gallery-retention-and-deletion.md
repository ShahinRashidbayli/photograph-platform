# 001 — Gallery retention and automatic deletion

**Status:** Accepted (2026-07-17) · **Not implemented.**
**Related:** `docs/PRICING.md` §4b (the commercial side), `docs/ROADMAP.md`

> **If you are here to build the expiry job, read §4 first.** Those four
> requirements are the point of this ADR. Deleting a client's wedding photos is
> the most destructive thing this product will ever do, and the failure lands on
> the photographer's reputation — not ours.

---

## 1. Context

Delivered galleries currently live forever. Nothing sets an expiry, nothing
deletes anything, and storage therefore grows without bound for as long as a
tenant exists. R2 bills GB × time, so this is a cost that only ever goes up.

Two things pushed the decision now:

- **Plans needed a value metric.** Gigabyte tiers were briefly advertised
  (Starter 30 GB / Pro 300 GB / Studio 1 TB) and were incoherent: with any
  bounded retention, storage stops being cumulative and collapses to the
  current window. Measured from real delivery weights (5–10 MB/photo; a portrait
  session ≈ 0.5 GB, a full wedding 2–6 GB), a **full-time wedding photographer
  holds only ~29 GB** in a 60-day window at peak season, and a 3-person studio
  ~86 GB. Nobody would ever have reached those caps, so gigabytes could not have
  driven a single upgrade.
- **`galleries.expires_at` already exists** in the tenant schema (nullable,
  never written), and the dashboard already renders a countdown plus an "expires
  in <7 days" warning. The model anticipated this; only the behaviour is missing.

## 2. Decision

**Gallery retention is the value metric, expressed in time rather than bytes.**

| Plan | Gallery stays online |
|---|---|
| Starter | 60 days |
| Pro | 1 year |
| Studio | 2 years |

Storage in gigabytes is **not sold**. A fair-use cap (Starter 50 GB · Pro 250 GB
· Studio 1 TB) may exist as an abuse guard, sized well above each tier's
realistic peak so it never binds an honest user, and is not advertised.

Retention is measured from the moment the gallery is **delivered/published**,
not from the booking or event date.

**Why time:** storage *is* production × retention, so the window already prices
the space — and it prices it in a unit the customer can reason about. A
photographer cannot estimate their gigabytes, but knows exactly what *"my client
came back eight months later asking for the photos"* costs them. It is
simultaneously the honest cost metric (R2 bills GB × time) and the emotional
one, which is what makes 60 days the thing that sells Pro's year.

## 3. Consequences accepted

- **60 days is aggressive for a wedding.** A couple honeymoons for three weeks,
  then shares the gallery with family who download slowly. This is deliberate —
  it is what creates the upgrade pressure — but it is only defensible with §4 in
  place.
- **Fotolio becomes a delivery platform, explicitly not an archive.** A
  photographer who treats us as their backup will eventually lose originals.
  This must be stated in the AGB, not just implied.
- **Automatic deletion is a DSGVO positive** (data minimisation) and worth
  stating in the Datenschutzerklärung as a feature, rather than hiding as a
  limitation.
- **Retention becomes an entitlement**, so it belongs in the plan→capabilities
  layer (`PRICING.md` §6) rather than as a scattered constant.

## 4. Requirements — non-negotiable before any gallery is deleted

Deletion is irreversible and its blast radius is someone else's wedding photos.
**None of these exist yet. The expiry job must not ship without them.**

1. **Reminder emails to the client** at roughly day 45 / 55 / 59.
   The dashboard countdown is *not* sufficient: a client who never opens the
   dashboard sees nothing at all, and photos then vanish silently. The client —
   not only the photographer — must be warned.

2. **The photographer can extend a gallery.**
   Without it, every missed window becomes a support ticket we are unable to
   resolve, because the data is already gone.

3. **Grace period: soft-delete first, hard-delete later.**
   Mark expired and revoke access, then remove bytes after a further margin. An
   irreversible destructive job needs room for *our own* bugs — a bad query that
   expires the wrong tenant must be recoverable.

4. **AGB states "delivery platform, not archive"** before the first deletion.
   Legal sign-off is a launch blocker for destroying customer data, not a
   detail. The AGB are currently placeholder drafts.

Additionally, when implementing:

- Enforce **server-side**. Retention is money and data; a client-supplied value
  must never decide it.
- Set `expires_at` **on write** (at delivery), from the tenant's plan — do not
  compute it at read time, or changing a plan silently rewrites history.
- The job must be **idempotent and rate-limited**; it will eventually run
  against every tenant schema.

## 5. Open

- What happens at the fair-use cap — block uploads, or bill overage?
- Does an expired gallery leave a tombstone the client can see ("this gallery
  expired on X — contact your photographer"), or a plain 404? A tombstone is
  kinder and cuts support load, but leaks that the booking existed.
- Do galleries on a downgraded plan get their retention shortened retroactively?
  (Follows the grandfathering question in `PRICING.md` §7.8.)
