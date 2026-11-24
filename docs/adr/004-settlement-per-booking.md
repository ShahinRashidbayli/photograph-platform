# 004 — Settlement is owned by invoice and counted per booking

**Status:** Accepted (2026-11-21) · **Implemented (2026-11-24)** by #64–#69.
**Related:** `GLOSSARY.md` (Settlement, Booked / Invoiced / Collected, Carried-over
payment, Credit), `docs/BUGS.md` FU-13, ADR-002 (module boundaries)

## Context

Whether an invoice or a booking is live, what is Outstanding, whether it is
Overdue, and which period it counts in was decided in about nine places across
`api` and `web`: booking's payment-state resolver, payment's own outstanding sum,
the analytics SQL, a client query, and four web helpers. They disagreed. A
reversed sale of X showed as −X in analytics, the dashboard counted enquiries as
revenue, and a paid invoice that was Storniert left its replacement Collectable,
so the Customer could pay twice.

## Decision

1. **`invoice` owns Settlement.** `booking`, `payment`, `analytics` and `client`
   ask it. Only `invoice` touches `InvoiceRepository` and only `payment` touches
   `PaymentRepository`. `payment` locks an invoice for payment through `invoice`,
   and `invoice` reads succeeded totals through `payment`. ArchUnit enforces this.
2. **Money in is settled per booking.** A payment on a Storniert invoice is a
   Carried-over payment and counts against the same booking's Live invoices,
   oldest first. Whatever is left over is Credit, shown on the booking.
   - *Rejected: block a Storno on a paid invoice.* No refund flow exists, so a
     photographer could not correct a paid invoice, and GoBD allows no other
     correction.
   - *Rejected: strict per-invoice Outstanding.* It keeps the double payment.
3. **Periods.** A Storno counts the way the DATEV export counts it: the original
   is +X in its issue month even after it is Storniert, and the Storno is −X in
   its own month. Collected counts in the month the payment succeeded, in
   Europe/Berlin (cash basis, as in an EÜR).
   - *Rejected: leave both documents out.* Reports would stop matching what the
     accountant receives.
   - *Rejected: Collected by invoice month.* A December invoice paid in January
     is January money.
4. **"Revenue" is not a figure.** Booked comes from `booking`; Invoiced and
   Collected come from `invoice`.

## Consequences

- Overdue stays at `issued_at` + 14 days until FU-13 adds a structured due date.
  After that, only the Settlement module changes.
- Web holds no money rules. It renders what the API derives, and dashboard tiles
  come from an ungated summary so STARTER keeps them.
