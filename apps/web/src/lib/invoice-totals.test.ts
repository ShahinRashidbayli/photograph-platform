import { calculateTotals, netFromGross, taxRateFor } from '@/lib/invoice-totals';

/**
 * These mirror `InvoiceTaxCalculatorTest` on the API side. The preview and the
 * server must agree to the cent: the photographer approves an amount here, and
 * the document the server writes from it cannot be edited afterwards.
 */
describe('invoice totals preview', () => {
  it('adds VAT on top of the net line price under Regelbesteuerung', () => {
    const totals = calculateTotals(
      [{ quantity: 1, unitPriceCents: 100_000, taxCategory: 'STANDARD' }],
      'REGELBESTEUERUNG'
    );
    expect(totals).toEqual({ subtotalCents: 100_000, taxCents: 19_000, totalCents: 119_000 });
  });

  it('charges no VAT at all under Kleinunternehmer, whatever the category', () => {
    const totals = calculateTotals(
      [
        { quantity: 1, unitPriceCents: 100_000, taxCategory: 'STANDARD' },
        { quantity: 1, unitPriceCents: 50_000, taxCategory: 'REDUCED' },
      ],
      'KLEINUNTERNEHMER'
    );
    expect(totals).toEqual({ subtotalCents: 150_000, taxCents: 0, totalCents: 150_000 });
  });

  it('applies the reduced and exempt rates per line', () => {
    expect(taxRateFor('REDUCED', 'REGELBESTEUERUNG')).toBe(7);
    expect(taxRateFor('EXEMPT', 'REGELBESTEUERUNG')).toBe(0);
    expect(taxRateFor('STANDARD', 'KLEINUNTERNEHMER')).toBe(0);
  });

  it('rounds each line half-up, like the server', () => {
    // 2.5 × 333 = 832.5 → 833
    const totals = calculateTotals(
      [{ quantity: 2.5, unitPriceCents: 333, taxCategory: 'EXEMPT' }],
      'REGELBESTEUERUNG'
    );
    expect(totals.subtotalCents).toBe(833);
  });

  describe('netFromGross', () => {
    it('recovers a net price that grosses back to the agreed total', () => {
      const net = netFromGross(119_000, 'STANDARD', 'REGELBESTEUERUNG');
      expect(net).toBe(100_000);
      expect(
        calculateTotals(
          [{ quantity: 1, unitPriceCents: net, taxCategory: 'STANDARD' }],
          'REGELBESTEUERUNG'
        ).totalCents
      ).toBe(119_000);
    });

    it('is a no-op when no VAT applies', () => {
      expect(netFromGross(119_000, 'STANDARD', 'KLEINUNTERNEHMER')).toBe(119_000);
      expect(netFromGross(119_000, 'EXEMPT', 'REGELBESTEUERUNG')).toBe(119_000);
    });

    /**
     * Rounding means the round-trip cannot always land exactly, but it must
     * never drift more than a cent — a euro of drift on a wedding invoice is
     * a Storno.
     */
    it('round-trips within a cent for awkward amounts', () => {
      for (const gross of [1, 99, 12_345, 99_999, 123_457]) {
        const net = netFromGross(gross, 'STANDARD', 'REGELBESTEUERUNG');
        const back = calculateTotals(
          [{ quantity: 1, unitPriceCents: net, taxCategory: 'STANDARD' }],
          'REGELBESTEUERUNG'
        ).totalCents;
        expect(Math.abs(back - gross)).toBeLessThanOrEqual(1);
      }
    });
  });
});
