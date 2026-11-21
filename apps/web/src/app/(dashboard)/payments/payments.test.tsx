import React from 'react';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import type { Invoice } from '@/types/api';
import PaymentsPage from './page';

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

// The real dialog loads Stripe.js, which injects a script tag jsdom cannot
// run. The page's job is deciding *whether* to offer payment.
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
    dueDate: '2026-08-15',
    live: true,
    collectable: true,
    overdue: false,
    verwendungszweck: 'RE-2026-0001',
    stornoOfId: null,
    pdfDownloadUrl: 'https://cdn.example/invoice.pdf',
    issuedAt: '2026-08-01T10:00:00Z',
    lineItems: [],
    ...overrides,
  };
}

/** What the server sends for a Storno and for the invoice it withdraws. */
const withdrawn = { outstandingCents: 0, dueDate: null, live: false, collectable: false };

/**
 * One GET serves the whole list — settlement figures ride on the invoice. Any
 * other route (a per-invoice `/payments` fan-out, say) is left unstubbed, so it
 * fails loudly rather than quietly costing a request per row again.
 */
function respond(invoices: Invoice[]) {
  mockedApi.get.mockImplementation((url: string) => {
    if (url === '/api/customer/invoices') return Promise.resolve({ data: invoices } as never);
    if (url.startsWith('/api/customerBookings')) return Promise.resolve({ data: [] } as never);
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

const invoiceRow = (number: string) => screen.getByRole('cell', { name: number }).closest('tr')!;

describe('PaymentsPage (client)', () => {
  beforeEach(() => mockedApi.get.mockReset());

  /**
   * "Paid" was once derived from figures fetched separately per row — which is
   * also what a failed request looked like, so a client whose summary did not
   * load was told their invoice was settled. A row that renders is a row whose
   * figures are the server's, from the one list request.
   */
  it('offers payment for the outstanding amount, from one request', async () => {
    respond([invoice()]);

    renderWithProviders(<PaymentsPage />, { lang: 'en' });

    const row = invoiceRow(await screen.findByText('2026-0001').then(() => '2026-0001'));
    expect(within(row).getByText('Open')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Pay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay €1,190' })).toBeInTheDocument();
    expect(
      mockedApi.get.mock.calls.filter(([url]) => url === '/api/customer/invoices')
    ).toHaveLength(1);
  });

  it('shows a part payment against the invoice', async () => {
    respond([invoice({ paidCents: 50_000, outstandingCents: 69_000 })]);

    renderWithProviders(<PaymentsPage />, { lang: 'en' });

    await screen.findByText('2026-0001');
    expect(within(invoiceRow('2026-0001')).getByText('€500 paid')).toBeInTheDocument();
  });

  it('marks a settled invoice paid and drops the pay action', async () => {
    respond([invoice({ paidCents: 119_000, outstandingCents: 0, collectable: false })]);

    renderWithProviders(<PaymentsPage />, { lang: 'en' });

    await screen.findByText('2026-0001');
    const row = invoiceRow('2026-0001');
    expect(within(row).getByText('Paid')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Pay' })).not.toBeInTheDocument();
    expect(screen.getByText('Everything is paid — thank you.')).toBeInTheDocument();
  });

  /**
   * A Storno is a credit note the client never pays, and the invoice it
   * corrects has been withdrawn. Listing either asks for money no live
   * document claims.
   */
  it('hides Storno invoices and the invoices they cancel', async () => {
    respond([
      invoice({ id: 'inv-1', invoiceNumber: '2026-0001', status: 'STORNIERT', ...withdrawn }),
      invoice({
        id: 'inv-2',
        invoiceNumber: '2026-0002',
        stornoOfId: 'inv-1',
        totalCents: -119_000,
        ...withdrawn,
      }),
      invoice({ id: 'inv-3', invoiceNumber: '2026-0003' }),
    ]);

    renderWithProviders(<PaymentsPage />, { lang: 'en' });

    expect(await screen.findByText('2026-0003')).toBeInTheDocument();
    expect(screen.queryByText('2026-0001')).not.toBeInTheDocument();
    expect(screen.queryByText('2026-0002')).not.toBeInTheDocument();
  });

  it('gives the transfer reference for an open invoice', async () => {
    respond([invoice()]);

    renderWithProviders(<PaymentsPage />, { lang: 'en' });

    expect(await screen.findByText(/Use the reference RE-2026-0001/)).toBeInTheDocument();
  });

  it('reports a failure to load rather than showing an empty list', async () => {
    mockedApi.get.mockRejectedValue(new Error('boom'));

    renderWithProviders(<PaymentsPage />, { lang: 'en' });

    expect(await screen.findByText(/couldn't load your invoices/i)).toBeInTheDocument();
    expect(screen.queryByText('No invoices yet.')).not.toBeInTheDocument();
  });
});
