import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import RevenuePage from './page';

/**
 * The revenue report's empty state against a faked API.
 *
 * <p>A Storno counts the way DATEV counts it (ADR-004 §3), so a year can have
 * no Live invoice and still have figures: the January Storno of a December
 * invoice is −X Invoiced in its own year, and a January payment for a December
 * invoice is Collected in January. The page used to call any year without a
 * Live invoice empty, which hid the correction.
 */
function fakeYear(revenue: {
  invoiceCount: number;
  invoicedCents: number;
  collectedCents: number;
}) {
  server.use(
    http.get('/api/analytics', () =>
      HttpResponse.json({
        year: 2027,
        availableYears: [2027, 2026],
        revenue: {
          ...revenue,
          outstandingCents: 0,
          averageInvoiceCents: 0,
          months: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            invoicedCents: i === 0 ? revenue.invoicedCents : 0,
            collectedCents: i === 0 ? revenue.collectedCents : 0,
          })),
        },
        bookings: {},
      })
    )
  );
}

const EMPTY_TITLE = 'Nothing in this year yet';

describe('RevenuePage', () => {
  it("keeps a year whose only document is the Storno of last year's invoice", async () => {
    fakeYear({ invoiceCount: 0, invoicedCents: -123_400, collectedCents: 0 });
    renderWithProviders(<RevenuePage />, { lang: 'en' });

    expect((await screen.findAllByText('-€1,234')).length).toBeGreaterThan(0);
    expect(screen.queryByText(EMPTY_TITLE)).toBeNull();
  });

  it("keeps a year whose only money is a payment for last year's invoice", async () => {
    fakeYear({ invoiceCount: 0, invoicedCents: 0, collectedCents: 56_700 });
    renderWithProviders(<RevenuePage />, { lang: 'en' });

    expect((await screen.findAllByText('€567')).length).toBeGreaterThan(0);
    expect(screen.queryByText(EMPTY_TITLE)).toBeNull();
  });

  it('shows an empty year as empty rather than as a chart of zeroes', async () => {
    fakeYear({ invoiceCount: 0, invoicedCents: 0, collectedCents: 0 });
    renderWithProviders(<RevenuePage />, { lang: 'en' });

    expect(await screen.findByText(EMPTY_TITLE)).toBeInTheDocument();
  });
});
