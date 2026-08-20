import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { InvoicePayList } from './InvoicePayList';
import type { Invoice } from '@/types/api';

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

// The real dialog loads Stripe.js, which injects a script tag jsdom cannot
// run. The list's job is deciding *whether* to offer payment, not rendering
// the card form.
jest.mock('@/components/StripePaymentModal', () => ({
  StripePaymentModal: () => <div data-testid="pay-dialog" />,
}));

import api from '@/lib/api';

const mockedApi = api as jest.Mocked<typeof api>;

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1',
    bookingId: 'bk-1',
    invoiceNumber: '2026-0001',
    status: 'ISSUED',
    taxMode: 'REGELBESTEUERUNG',
    buyerName: 'Maria Kellner',
    buyerEmail: 'maria@example.test',
    currency: 'EUR',
    subtotalCents: 100_000,
    taxCents: 19_000,
    totalCents: 119_000,
    paidCents: 0,
    outstandingCents: 119_000,
    verwendungszweck: 'RE-2026-0001',
    stornoOfId: null,
    pdfDownloadUrl: 'https://cdn.example/invoice.pdf',
    issuedAt: '2026-08-01T10:00:00Z',
    lineItems: [],
    ...overrides,
  };
}

/**
 * One GET now serves the whole list — settlement figures ride on the invoice.
 * The per-invoice `/payments` route this used to fan out to is deliberately
 * left unstubbed, so a reintroduced per-row fetch fails the suite loudly rather
 * than quietly costing a request per row again.
 */
function respond(invoices: Invoice[]) {
  mockedApi.get.mockImplementation((url: string) => {
    if (url === '/api/customer/invoices') {
      return Promise.resolve({ data: invoices } as never);
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

describe('InvoicePayList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers payment for the outstanding amount', async () => {
    respond([invoice()]);

    renderWithProviders(<InvoicePayList />);

    expect(await screen.findByRole('button', { name: /Pay €1,190\.00/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
      'href',
      'https://cdn.example/invoice.pdf'
    );
  });

  it('shows a part payment against the total', async () => {
    respond([invoice({ paidCents: 30_000, outstandingCents: 89_000 })]);

    renderWithProviders(<InvoicePayList />);

    expect(await screen.findByText(/€300\.00 paid/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pay €890\.00/ })).toBeInTheDocument();
  });

  it('marks a settled invoice paid and drops the pay action', async () => {
    respond([invoice({ paidCents: 119_000, outstandingCents: 0 })]);

    renderWithProviders(<InvoicePayList />);

    expect(await screen.findByText('Paid')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pay/ })).not.toBeInTheDocument();
  });

  /**
   * The regression this guards, in its current form.
   *
   * <p>"Paid" used to be derived from `outstanding === 0` against figures
   * fetched separately per row — which is also what a failed request looked
   * like, so a client whose summary did not load was told their invoice was
   * settled and stopped trying to pay. The figures now arrive with the invoice,
   * so there is no half-loaded row to misread: either the list resolved and the
   * amounts are real, or the whole list reports failure (below). This pins the
   * first half — a row that rendered is a row whose figures are the server's.
   */
  it('never shows a row without the server’s own settlement figures', async () => {
    respond([invoice({ paidCents: 0, outstandingCents: 119_000 })]);

    renderWithProviders(<InvoicePayList />);

    expect(await screen.findByText(/Invoice 2026-0001/)).toBeInTheDocument();
    expect(screen.queryByText('Paid')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pay €1,190\.00/ })).toBeInTheDocument();
    // One request for the page, not one per invoice.
    expect(mockedApi.get).toHaveBeenCalledTimes(1);
  });

  /**
   * A Storno is a credit note the client never pays, and the invoice it
   * corrects has been legally withdrawn. Listing either as payable asks for
   * money no live document claims.
   */
  it('hides Storno invoices and the invoices they cancel', async () => {
    respond([
      invoice({ id: 'inv-1', invoiceNumber: '2026-0001', status: 'STORNIERT' }),
      invoice({
        id: 'inv-2',
        invoiceNumber: '2026-0002',
        stornoOfId: 'inv-1',
        totalCents: -119_000,
      }),
      invoice({ id: 'inv-3', invoiceNumber: '2026-0003' }),
    ]);

    renderWithProviders(<InvoicePayList />);

    expect(await screen.findByText(/Invoice 2026-0003/)).toBeInTheDocument();
    expect(screen.queryByText(/Invoice 2026-0001/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Invoice 2026-0002/)).not.toBeInTheDocument();
  });

  it('scopes to one booking when asked', async () => {
    respond([
      invoice({ id: 'inv-1', invoiceNumber: '2026-0001', bookingId: 'bk-1' }),
      invoice({ id: 'inv-2', invoiceNumber: '2026-0002', bookingId: 'bk-2' }),
    ]);

    renderWithProviders(<InvoicePayList bookingId="bk-2" />);

    expect(await screen.findByText(/Invoice 2026-0002/)).toBeInTheDocument();
    expect(screen.queryByText(/Invoice 2026-0001/)).not.toBeInTheDocument();
  });

  it('explains the empty case in the booking’s own terms', async () => {
    respond([]);

    renderWithProviders(<InvoicePayList bookingId="bk-1" emptyKey="invoices.emptyForBooking" />);

    expect(
      await screen.findByText(/hasn’t sent an invoice for this session yet/)
    ).toBeInTheDocument();
  });

  it('reports a failure to load rather than showing an empty list', async () => {
    mockedApi.get.mockRejectedValue(new Error('boom'));

    renderWithProviders(<InvoicePayList />);

    expect(await screen.findByText(/couldn't load your invoices/i)).toBeInTheDocument();
  });
});
