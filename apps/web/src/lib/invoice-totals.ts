import type { TaxCategory, TaxMode } from '@/types/api';

/**
 * Client-side mirror of the backend's `InvoiceTaxCalculator`.
 *
 * <p>Exists so the photographer can see what the client will actually be
 * billed *before* issuing — an invoice is GoBD-immutable the moment it exists,
 * so a surprise on the total is not correctable, only cancellable with a
 * Storno. The arithmetic (integer cents, HALF_UP rounding, tax applied per
 * line) is kept identical to the server on purpose; the server stays the
 * authority, this is only a preview.
 */

const RATE_PERCENT: Record<TaxCategory, number> = {
  STANDARD: 19,
  REDUCED: 7,
  EXEMPT: 0,
};

/** The rate actually applied — Kleinunternehmer (§19 UStG) never charges VAT. */
export function taxRateFor(category: TaxCategory, taxMode: TaxMode): number {
  return taxMode === 'KLEINUNTERNEHMER' ? 0 : RATE_PERCENT[category];
}

/** Matches Java's `RoundingMode.HALF_UP`, which rounds .5 away from zero. */
function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

export interface TotalsLineInput {
  quantity: number;
  unitPriceCents: number;
  taxCategory: TaxCategory;
}

export interface Totals {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

export function calculateTotals(lines: TotalsLineInput[], taxMode: TaxMode): Totals {
  let subtotalCents = 0;
  let taxCents = 0;
  for (const line of lines) {
    const lineTotal = roundHalfUp(line.quantity * line.unitPriceCents);
    const rate = taxRateFor(line.taxCategory, taxMode);
    subtotalCents += lineTotal;
    taxCents += roundHalfUp((lineTotal * rate) / 100);
  }
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

/**
 * The net unit price that grosses up to `grossCents` under a given tax
 * treatment.
 *
 * <p>Needed because the two numbers this app holds are not the same kind of
 * number: `booking.totalAmountCents` is what the client agreed to pay — gross,
 * as German consumer pricing must be quoted (PAngV) — while an invoice line
 * takes a NET price and has VAT added on top. Seeding the line with the booking
 * total directly would bill a Regelbesteuerung photographer's client 19% over
 * the agreed price, on a document that cannot be edited afterwards.
 */
export function netFromGross(grossCents: number, category: TaxCategory, taxMode: TaxMode): number {
  const rate = taxRateFor(category, taxMode);
  if (rate === 0) return grossCents;
  return roundHalfUp((grossCents * 100) / (100 + rate));
}
