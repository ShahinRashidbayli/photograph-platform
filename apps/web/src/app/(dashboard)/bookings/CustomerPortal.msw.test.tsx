import React from 'react';
import { screen, within } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { useAuthStore } from '@/store/authStore';
import type { Booking, Invoice } from '@/types/api';
import { CustomerPortal } from './CustomerPortal';

let mockSearch = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearch,
}));

// Stripe.js cannot load in jsdom; what matters is which invoice paying opens.
jest.mock('@/components/StripePaymentModal', () => ({
  StripePaymentModal: ({ invoice }: { invoice: Invoice }) => (
    <div data-testid="pay-dialog">{invoice.invoiceNumber}</div>
  ),
}));

/**
 * The Customer's pay action against a faked API.
 *
 * <p>Whether an invoice can still be paid is the server's answer, Collectable
 * (ADR-004). The portal offers payment where it says so and nowhere else,
 * rather than keeping its own copy of the rule from the status and the
 * figures, which is a copy that can disagree with the payment endpoint.
 */

const wedding = {
  id: 'bk-wedding',
  clientName: 'Anna Schneider',
  clientEmail: 'anna@example.test',
  // Far enough ahead that the test does not age into "past".
  eventDate: '2099-06-12',
  eventType: 'HOCHZEIT',
  totalAmountCents: 100_000,
  amountPaidCents: 0,
  paymentState: 'OPEN',
  status: 'CONFIRMED',
  createdAt: '2026-11-01T10:00:00Z',
} as Booking;

function invoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: 'inv-rest',
    bookingId: 'bk-wedding',
    invoiceNumber: 'RE-2026-014',
    status: 'ISSUED',
    taxMode: 'KLEINUNTERNEHMER',
    buyerName: 'Anna Schneider',
    buyerEmail: 'anna@example.test',
    currency: 'EUR',
    subtotalCents: 70_000,
    taxCents: 0,
    totalCents: 70_000,
    paidCents: 0,
    outstandingCents: 70_000,
    dueDate: '2026-11-18',
    live: true,
    collectable: true,
    overdue: false,
    verwendungszweck: 'RE-2026-014',
    stornoOfId: null,
    pdfDownloadUrl: null,
    issuedAt: '2026-11-04T10:00:00Z',
    lineItems: [],
    ...overrides,
  };
}

const collectable = invoice({});
/** Figures that look owed, but the server says there is nothing to collect on it. */
const notCollectable = invoice({
  id: 'inv-deposit',
  invoiceNumber: 'RE-2026-009',
  verwendungszweck: 'RE-2026-009',
  totalCents: 30_000,
  outstandingCents: 30_000,
  collectable: false,
  issuedAt: '2026-10-20T10:00:00Z',
});

function fakeApi(invoices: Invoice[]) {
  server.use(
    http.get('/api/customerBookings', () => HttpResponse.json([wedding])),
    http.get('/api/customer/contracts', () => HttpResponse.json([])),
    http.get('/api/customer/invoices', () => HttpResponse.json(invoices)),
    http.get('/api/customer/galleries', () => HttpResponse.json([])),
    http.get('/api/customer/inquiry-requests', () => HttpResponse.json([])),
    http.get('/api/public/legal/:subdomain', () =>
      HttpResponse.json({ subdomain: 'studio-lichtblick', legalName: 'Lena Hoffmann' })
    )
  );
}

beforeEach(() => {
  mockSearch = new URLSearchParams();
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'anna@example.test',
      fullName: 'Anna Schneider',
      role: 'CUSTOMER',
      emailVerified: true,
      tenant: { subdomain: 'studio-lichtblick', plan: 'PRO' },
    },
  });
});

afterEach(() => useAuthStore.setState({ user: null }));

describe('the Customer pay action', () => {
  it('asks the Customer to pay only the invoices the server says are Collectable', async () => {
    fakeApi([collectable, notCollectable]);
    const user = setupUser();
    renderWithProviders(<CustomerPortal />, { lang: 'en' });

    const todo = (await screen.findByRole('heading', { name: 'To do' })).closest('section')!;
    expect(within(todo).getByText('Pay €700')).toBeInTheDocument();
    expect(within(todo).queryByText('Pay €300')).not.toBeInTheDocument();

    await user.click(within(todo).getByRole('button', { name: 'Pay' }));
    expect(screen.getByTestId('pay-dialog')).toHaveTextContent('RE-2026-014');
  });

  it('offers payment on the shoot only where the server says it is Collectable', async () => {
    mockSearch = new URLSearchParams('id=bk-wedding');
    fakeApi([collectable, notCollectable]);
    renderWithProviders(<CustomerPortal />, { lang: 'en' });

    expect(await screen.findByRole('button', { name: 'Pay €700' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pay €300' })).not.toBeInTheDocument();
  });

  /** A Storno and the invoice it withdraws are the studio's records, not something to pay. */
  it('leaves out invoices that are not Live', async () => {
    mockSearch = new URLSearchParams('id=bk-wedding');
    fakeApi([
      collectable,
      invoice({
        id: 'inv-old',
        invoiceNumber: 'RE-2026-003',
        status: 'STORNIERT',
        outstandingCents: 0,
        dueDate: null,
        live: false,
        collectable: false,
      }),
    ]);
    renderWithProviders(<CustomerPortal />, { lang: 'en' });

    expect(await screen.findByText(/Invoice RE-2026-014/)).toBeInTheDocument();
    expect(screen.queryByText(/Invoice RE-2026-003/)).not.toBeInTheDocument();
  });
});
