import React from 'react';
import { screen, within } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import type { Booking, Invoice } from '@/types/api';
import { BookingInvoices } from './BookingInvoices';

/**
 * The studio's invoice list for one booking, against a faked API.
 *
 * <p>When an invoice is due, whether it is Overdue and whether anything can
 * still be collected on it are the server's answers (ADR-004): the list shows
 * them as they arrive and works none of them out itself.
 */

const booking = {
  id: 'bk-1',
  clientName: 'Sophie Bauer',
  clientEmail: 'sophie@example.test',
  eventDate: '2026-12-12',
  status: 'CONFIRMED',
  totalAmountCents: 100_000,
  paymentState: 'OVERDUE',
  amountPaidCents: 0,
  createdAt: '2026-10-01T10:00:00Z',
} as Booking;

function invoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: 'inv-1',
    bookingId: 'bk-1',
    invoiceNumber: '2026-0001',
    status: 'ISSUED',
    taxMode: 'KLEINUNTERNEHMER',
    buyerName: 'Sophie Bauer',
    buyerEmail: 'sophie@example.test',
    currency: 'EUR',
    subtotalCents: 30_000,
    taxCents: 0,
    totalCents: 30_000,
    paidCents: 0,
    outstandingCents: 30_000,
    dueDate: '2026-11-15',
    live: true,
    collectable: true,
    overdue: false,
    verwendungszweck: '2026-0001',
    stornoOfId: null,
    pdfDownloadUrl: null,
    issuedAt: '2026-11-01T10:00:00Z',
    lineItems: [],
    ...overrides,
  };
}

const deposit = invoice({ overdue: true });
const finalInvoice = invoice({
  id: 'inv-2',
  invoiceNumber: '2026-0002',
  verwendungszweck: '2026-0002',
  totalCents: 70_000,
  outstandingCents: 70_000,
  dueDate: '2026-12-03',
  issuedAt: '2026-11-19T10:00:00Z',
});

function fakeInvoices(invoices: Invoice[]) {
  server.use(http.get('/api/bookings/:id/invoices', () => HttpResponse.json(invoices)));
}

const row = (number: string) => screen.getByText(number).closest('.bk-inv-row') as HTMLElement;

describe('BookingInvoices', () => {
  it('shows when each invoice is due and marks the Overdue one', async () => {
    fakeInvoices([finalInvoice, deposit]);
    renderWithProviders(<BookingInvoices booking={booking} theme="light" />, { lang: 'en' });

    await screen.findByText('2026-0001');
    expect(within(row('2026-0001')).getByText(/Due Nov 15, 2026/)).toBeInTheDocument();
    expect(within(row('2026-0001')).getByText('Overdue')).toBeInTheDocument();
    expect(within(row('2026-0002')).getByText(/Due Dec 3, 2026/)).toBeInTheDocument();
    expect(within(row('2026-0002')).queryByText('Overdue')).not.toBeInTheDocument();
    expect(within(row('2026-0002')).getByText('Open')).toBeInTheDocument();
  });

  it('says it in German too', async () => {
    fakeInvoices([deposit]);
    renderWithProviders(<BookingInvoices booking={booking} theme="light" />, { lang: 'de' });

    await screen.findByText('2026-0001');
    expect(within(row('2026-0001')).getByText(/Fällig 15\. Nov\. 2026/)).toBeInTheDocument();
    expect(within(row('2026-0001')).getByText('Überfällig')).toBeInTheDocument();
  });

  /** A Storno and the invoice it withdraws are never paid, so they have no Due date to show. */
  it('shows no Due date on a Storno or the invoice it withdraws', async () => {
    fakeInvoices([
      invoice({
        id: 'inv-3',
        invoiceNumber: '2026-0003',
        stornoOfId: 'inv-1',
        totalCents: -30_000,
        outstandingCents: 0,
        dueDate: null,
        live: false,
        collectable: false,
      }),
      invoice({
        status: 'STORNIERT',
        outstandingCents: 0,
        dueDate: null,
        live: false,
        collectable: false,
      }),
    ]);
    renderWithProviders(<BookingInvoices booking={booking} theme="light" />, { lang: 'en' });

    await screen.findByText('2026-0003');
    expect(screen.queryByText(/Due /)).not.toBeInTheDocument();
    expect(within(row('2026-0001')).getByText('Cancelled')).toBeInTheDocument();
    expect(within(row('2026-0003')).getByText('Storno')).toBeInTheDocument();
  });

  /**
   * Recording a transfer is offered where the server says money can still be
   * collected, and nowhere else, whatever the figures on the row add up to.
   */
  it('offers to record a transfer only on a Collectable invoice', async () => {
    fakeInvoices([
      finalInvoice,
      invoice({ outstandingCents: 30_000, collectable: false, overdue: false }),
    ]);
    const user = setupUser();
    renderWithProviders(<BookingInvoices booking={booking} theme="light" />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Actions for invoice 2026-0002' }));
    expect(screen.getByRole('menuitem', { name: 'Record bank transfer' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Actions for invoice 2026-0001' }));
    expect(
      screen.queryByRole('menuitem', { name: 'Record bank transfer' })
    ).not.toBeInTheDocument();
  });
});
