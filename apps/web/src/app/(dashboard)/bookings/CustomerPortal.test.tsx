import React from 'react';
import { screen, within } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { useAuthStore } from '@/store/authStore';
import type { Booking, Invoice } from '@/types/api';
import type { Contract } from '@/hooks/useContracts';
import type { CustomerGallery } from '@/hooks/useGalleries';
import type { CustomerInquiryRequest } from '@/hooks/useInquiryRequests';
import { CustomerPortal } from './CustomerPortal';

let mockSearch = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearch,
}));

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

// Stripe.js cannot load in jsdom; what matters is that paying opens it.
jest.mock('@/components/StripePaymentModal', () => ({
  StripePaymentModal: ({ invoice }: { invoice: Invoice }) => (
    <div data-testid="pay-dialog">{invoice.invoiceNumber}</div>
  ),
}));

import api from '@/lib/api';

const mockedApi = api as jest.Mocked<typeof api>;

/**
 * The client portal as a client meets it: what is waiting on them comes first,
 * and each item leads straight to where it is done — the contract itself, the
 * payment, the gallery.
 */

// Far enough ahead that the test does not age into "past".
const WEDDING_DATE = '2099-06-12';

const wedding: Booking = {
  id: 'bk-wedding',
  clientName: 'Anna Schneider',
  clientEmail: 'anna@example.test',
  eventDate: WEDDING_DATE,
  eventTime: '13:00:00',
  eventType: 'HOCHZEIT',
  location: 'Schloss Bensberg',
  totalAmountCents: 100_000,
  depositAmountCents: 30_000,
  amountPaidCents: 30_000,
  paymentState: 'PARTIALLY_PAID',
  status: 'CONFIRMED',
  createdAt: '2026-11-01T10:00:00Z',
};

const family: Booking = {
  ...wedding,
  id: 'bk-family',
  eventDate: '2026-09-20',
  eventTime: undefined,
  eventType: 'FAMILIE',
  location: 'Rheinpark',
  totalAmountCents: 45_000,
  amountPaidCents: 45_000,
  paymentState: 'PAID',
  status: 'COMPLETED',
};

const contract: Contract = {
  id: 'ct-1',
  bookingId: 'bk-wedding',
  status: 'SENT',
  title: 'Fotografievertrag',
  body: '',
  recipientName: 'Anna Schneider',
  recipientEmail: 'anna@example.test',
  issuerName: 'Studio Lichtblick',
  issuerAddress: null,
  issuerEmail: null,
  signerName: null,
  signedAt: null,
  sentAt: '2026-11-03T10:00:00Z',
  cancelledAt: null,
  createdAt: '2026-11-03T10:00:00Z',
  editable: false,
  intact: true,
};

const rest: Invoice = {
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
};

const gallery: CustomerGallery = {
  id: 'gal-1',
  bookingId: 'bk-family',
  eventType: 'FAMILIE',
  shootDate: '2026-09-20',
  photoCount: 248,
  downloadEnabled: true,
  expiresAt: '2099-01-20T00:00:00Z',
  accessToken: 'tok123',
  coverUrl: null,
};

const request: CustomerInquiryRequest = {
  id: 'rq-1',
  eventType: 'PORTRAIT',
  budgetRange: 'UNDER_500',
  proposedDate: '2099-03-14',
  location: 'Köln',
  message: null,
  status: 'PENDING',
  createdAt: '2026-11-08T09:00:00Z',
};

function respond(overrides: Partial<Record<string, unknown>> = {}) {
  const routes: Record<string, unknown> = {
    '/api/customer/contracts': [contract],
    '/api/customer/invoices': [rest],
    '/api/customer/galleries': [gallery],
    '/api/customer/inquiry-requests': [request],
    '/api/public/legal/studio-lichtblick': {
      subdomain: 'studio-lichtblick',
      legalName: 'Lena Hoffmann',
      legalEmail: 'lena@studio.example',
      legalPhone: '+49 171 2345678',
    },
    ...overrides,
  };
  mockedApi.get.mockImplementation((url: string) => {
    if (url.startsWith('/api/customerBookings')) {
      return Promise.resolve({ data: url.includes('page=0') ? [wedding, family] : [] } as never);
    }
    const data = routes[url];
    if (data instanceof Error) return Promise.reject(data);
    if (data !== undefined) return Promise.resolve({ data } as never);
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

beforeEach(() => {
  mockedApi.get.mockReset();
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

describe('the overview', () => {
  it('greets the client and lists what is waiting on them, in order', async () => {
    respond();
    renderWithProviders(<CustomerPortal />, { lang: 'en' });

    expect(await screen.findByRole('heading', { name: 'Hello Anna' })).toBeInTheDocument();
    const todo = screen.getByRole('heading', { name: 'To do' }).closest('section')!;
    const titles = within(todo)
      .getAllByText(/Sign the contract|Pay €700|Your photos are ready/)
      .map((el) => el.textContent);
    expect(titles).toEqual(['Sign the contract', 'Pay €700', 'Your photos are ready']);
  });

  it('sends the signature to the contract itself and the photos to the gallery', async () => {
    respond();
    renderWithProviders(<CustomerPortal />, { lang: 'en' });

    expect(await screen.findByRole('link', { name: 'Read & sign' })).toHaveAttribute(
      'href',
      '/documents?id=ct-1'
    );
    expect(screen.getByRole('link', { name: 'Open gallery' })).toHaveAttribute(
      'href',
      '/g/studio-lichtblick/tok123'
    );
  });

  it('opens the payment for the invoice that was chosen', async () => {
    respond();
    const user = setupUser();
    renderWithProviders(<CustomerPortal />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Pay' }));
    expect(screen.getByTestId('pay-dialog')).toHaveTextContent('RE-2026-014');
  });

  it('shows a request the photographer has not answered yet', async () => {
    respond();
    renderWithProviders(<CustomerPortal />, { lang: 'en' });

    const requests = (await screen.findByRole('heading', { name: 'Your requests' })).closest(
      'section'
    )!;
    expect(within(requests).getByText('Portrait · preferred date')).toBeInTheDocument();
    expect(within(requests).getByText('Waiting for a reply')).toBeInTheDocument();
  });

  /** "Photos delivered" only once there are photos; the studio closes a booking before delivery. */
  it('says a finished shoot is delivered only when a gallery exists', async () => {
    respond({ '/api/customer/galleries': [] });
    renderWithProviders(<CustomerPortal />, { lang: 'en' });

    await screen.findByRole('heading', { name: 'Your shoots' });
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.queryByText('Photos delivered')).not.toBeInTheDocument();
  });

  it('names the studio from its published contact details', async () => {
    respond();
    renderWithProviders(<CustomerPortal />, { lang: 'en' });

    expect(
      await screen.findByText('Questions? Lena Hoffmann is happy to help.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Write an email' })).toHaveAttribute(
      'href',
      'mailto:lena@studio.example'
    );
  });

  it('still shows the shoots when a secondary source fails, and says so', async () => {
    respond({ '/api/customer/galleries': new Error('boom') });
    renderWithProviders(<CustomerPortal />, { lang: 'en' });

    expect(await screen.findByText(/may be incomplete/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your shoots' })).toBeInTheDocument();
  });
});

describe('one shoot', () => {
  it('lays out the steps in the order they happen', async () => {
    mockSearch = new URLSearchParams('id=bk-wedding');
    respond();
    renderWithProviders(<CustomerPortal />, { lang: 'en' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Wedding' })).toBeInTheDocument();
    const steps = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(steps).toEqual(['1Sign the contract', '2Pay', '3Your photos']);
    const progress = screen.getByRole('list', { name: 'Progress' });
    expect(within(progress).getByText('Contract to sign').closest('li')).toHaveAttribute(
      'aria-current',
      'step'
    );
  });

  /** The old copy read "due Nov 19 — 11 days before your session" for a balance due on the session day. */
  it('says the balance is due by the shoot, not some days before it', async () => {
    mockSearch = new URLSearchParams('id=bk-wedding');
    respond();
    renderWithProviders(<CustomerPortal />, { lang: 'en' });

    expect(await screen.findByText('The open amount is due by June 12, 2099.')).toBeInTheDocument();
    expect(screen.queryByText(/before your session/)).not.toBeInTheDocument();
    expect(screen.getByText(/Use the reference RE-2026-014/)).toBeInTheDocument();
  });

  it('says so when the shoot in the link is not the client’s', async () => {
    mockSearch = new URLSearchParams('id=someone-else');
    respond();
    renderWithProviders(<CustomerPortal />, { lang: 'en' });

    expect(await screen.findByText('This shoot isn’t here any more.')).toBeInTheDocument();
  });
});
