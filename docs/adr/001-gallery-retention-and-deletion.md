# 001 — Gallery retention and automatic deletion

**Status:** Accepted (2026-07-17) · **Implemented (2026-08-22).**
**Related:** `docs/PRICING.md` §4b (the commercial side), `docs/ROADMAP.md`

> **If you are here to change the expiry job, read §4 first.** Those four
> requirements are the point of this ADR. Deleting a client's wedding photos is
> the most destructive thing this product will ever do, and the failure lands on
> the photographer's reputation — not ours.
>
> All four now exist — see §4 for where each one lives. **The destructive phase
> is still off by default** (`app.retention.purge-enabled`, `RETENTION_PURGE_ENABLED`):
> §4.4 makes the AGB wording a precondition for the first deletion, and an
> environment that has not confirmed its own terms should expire and warn
> without ever purging.

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
**All four are implemented; the destructive phase stays off until §4.4 is
signed off.**

1. **Reminder emails to the client** — ✅ `GalleryExpiryNotificationService`,
   driven by `GalleryRetentionService#sendDueReminders`.
   The dashboard countdown is *not* sufficient: a client who never opens the
   dashboard sees nothing at all, and photos then vanish silently. The client —
   not only the photographer — must be warned.

   Expressed as **days before expiry (15 / 5 / 1)** rather than the days
   45/55/59 written above. Those numbers only make sense for a 60-day window;
   on Pro's year "day 45" would be a reminder ten months early. Sent in German,
   to the client — they never picked a language in our UI.

   Idempotent through `gallery_expiry_reminders(gallery_id, days_before)`
   UNIQUE: a re-run, or two instances overlapping past a lease, cannot email a
   client twice in one morning about their wedding photos expiring. After
   downtime only the *most urgent* unsent threshold is sent, and the ones it
   overtook are recorded so a stale warning can never fire later.

2. **The photographer can extend a gallery** — ✅ `POST /api/galleries/{id}/extend`.
   Without it, every missed window becomes a support ticket we are unable to
   resolve, because the data is already gone.

   Grants one full plan-sized window measured from *now*, and works on an
   already-EXPIRED gallery — that recovery path is the entire point of the
   grace period. It refuses only once the bytes are gone (409). It is
   deliberately not a settable `expiresAt`: that field used to be on the PATCH
   body, which let the browser decide how long a gallery lived.

3. **Grace period: soft-delete first, hard-delete later** — ✅ `expiry_state`
   ACTIVE → EXPIRED → PURGED, with `purge_after = soft_deleted_at + 30 days`.
   Mark expired and revoke access, then remove bytes after a further margin. An
   irreversible destructive job needs room for *our own* bugs — a bad query that
   expires the wrong tenant must be recoverable.

   Belt and braces on top: the purge phase **refuses a gallery whose client was
   never warned** and logs it as an error, because a gallery reaching deletion
   with no reminder row means the reminder phase did not run — which is exactly
   the silent vanishing §4.1 forbids.

4. **AGB states "delivery platform, not archive"** — ✅ AGB Teil A §6a and
   Datenschutzerklärung §6 (`apps/web/src/lib/legal-content.ts`), naming the
   per-plan windows, the 30-day grace period, the client warnings and the
   photographer's own backup duty.
   Legal sign-off is a launch blocker for destroying customer data, not a
   detail. **The text is drafted, not reviewed by a lawyer** — that review, not
   the code, is what should gate flipping `RETENTION_PURGE_ENABLED` on.

Additionally, as required below:

- **Server-side** — retention comes from the tenant's plan via
  `EntitlementService`; `CreateGalleryRequest` no longer has an `expiresAt`
  field at all.
- **Set on write** — `Gallery`'s constructor stamps `delivered_at`,
  `retention_days` and `expires_at` together, so a later plan change cannot
  rewrite the window a client was already promised.
- **Idempotent and rate-limited** — every phase is guarded by a state
  transition or a UNIQUE constraint, capped at `app.retention.max-per-run` per
  tenant per run, and the whole sweep runs under a `JobLock` lease so two
  replicas cannot purge concurrently.

Additionally, when implementing:

- Enforce **server-side**. Retention is money and data; a client-supplied value
  must never decide it.
- Set `expires_at` **on write** (at delivery), from the tenant's plan — do not
  compute it at read time, or changing a plan silently rewrites history.
- The job must be **idempotent and rate-limited**; it will eventually run
  against every tenant schema.

## 5. Open

- What happens at the fair-use cap — block uploads, or bill overage? Still
  open; the cap is configured (`app.plans.tiers.*.fair-use-storage-gb`) and
  nothing enforces it yet.

- ~~Tombstone or plain 404 for an expired gallery?~~ → **tombstone, 2026-08-22.**
  The privacy objection does not survive contact with the URL: it carries a
  64-character capability token, so anyone who can read the response already
  held the private link and learns nothing new. A bare 404 reads as a broken
  link and becomes a support ticket for the photographer instead of a request
  to extend. See `ExpiredGalleryNotice` and `PublicGalleryResponse#expired`.
  The ZIP endpoint still 404s — it streams bytes, so there is nothing kind to
  return.

- ~~Do galleries on a downgraded plan get their retention shortened
  retroactively?~~ → **no, 2026-08-22.** Settled by §4's own "set `expires_at`
  on write": the window is captured on the row at delivery, so a plan change
  affects only galleries delivered afterwards. Shortening retroactively would
  mean a downgrade could delete photos a client had already been promised a
  date for.
