-- Concurrency guards on the payment path.
--
-- Both payment entry points read the invoice's outstanding balance, decide
-- against it, and only then write — a check-then-act that nothing serialised.
-- Two requests interleaving inside that window is not exotic: a double-clicked
-- Pay button and a second browser tab both produce it.
--
--   createStripePaymentIntent: both callers see no open intent, both create a
--   live PaymentIntent on the connected account, and the invoice is charged
--   twice if the client confirms either one from the tab that still holds it.
--
--   recordManualPayment: both callers see the same `outstanding`, both pass the
--   "not more than outstanding" check, and the invoice ends up over-collected —
--   money the invoice never claimed, which then has to be refunded outside the
--   system and leaves the DATEV export reporting more revenue than was billed.
--
-- The service now takes a row lock on the invoice for the whole of either
-- operation (see PaymentService#lockInvoiceForPayment), which is the actual
-- fix. The index below is the backstop: application-level exclusion is only as
-- good as every future caller remembering it, and this is money.

-- Any pre-existing duplicate would make the index creation fail. Keep the
-- newest PENDING intent per invoice and cancel the rest — the older ones are
-- by definition superseded, and CANCELED is the status the supersede path
-- already assigns them.
UPDATE payments p
SET status = 'CANCELED'
WHERE p.status = 'PENDING'
  AND EXISTS (
      SELECT 1 FROM payments newer
      WHERE newer.invoice_id = p.invoice_id
        AND newer.status = 'PENDING'
        AND (newer.created_at, newer.id) > (p.created_at, p.id)
  );

-- At most one open Stripe intent per invoice. Partial on purpose: manual
-- Überweisung rows are written straight to SUCCEEDED and an invoice may
-- legitimately collect several of them (a deposit, then the balance), so only
-- the PENDING state is constrained.
CREATE UNIQUE INDEX uq_payments_one_pending_per_invoice
    ON payments (invoice_id)
    WHERE status = 'PENDING';
