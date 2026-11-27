import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { getColors } from '@/lib/design-tokens';
import type { Locale } from '@/lib/i18n';
import type { Booking, Invoice } from '@/types/api';
import { useBookings } from '@/hooks/useBookings';
import { BookingDetail } from './BookingDetail';
import { getBookingsStyles } from './bookings.styles';
import type { BookingContext } from './bookings.insights';

jest.mock('next/navigation', () => ({
  usePathname: () => '/bookings',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

/**
 * The booking detail against a faked API.
 *
 * <p>What these pin is the screen's own judgement, the part the redesign was
 * for: the lead button follows what the booking needs (not the status
 * machine's first legal move), nothing legal disappears, and the inline note
 * saves without clobbering fields this screen never loaded.
 */

const TODAY = new Date(2026, 10, 8); // Sunday 8 Nov 2026

const ctx: BookingContext = {
  today: TODAY,
  contract: null,
  gallery: null,
  contractsEnabled: false,
};

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'bk-1',
    clientName: 'Sophie & Luca Bauer',
    clientEmail: 'sophie@example.test',
    eventDate: '2026-11-19',
    eventTime: '15:00:00',
    eventType: 'Family shoot',
    location: 'Nordpark, Düsseldorf',
    totalAmountCents: 115_000,
    depositAmountCents: 45_000,
    status: 'CONFIRMED',
    paymentState: 'PARTIALLY_PAID',
    amountPaidCents: 45_000,
    internalNotes: 'Golden hour.',
    assignedUserId: 'u-1',
    assignedUserName: 'Shahin R.',
    createdAt: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

const openInvoice = {
  id: 'inv-2',
  bookingId: 'bk-1',
  invoiceNumber: 'RE-2026-0021',
  status: 'ISSUED',
  totalCents: 70_000,
  paidCents: 0,
  outstandingCents: 70_000,
  dueDate: '2026-11-15',
  live: true,
  collectable: true,
  overdue: false,
  verwendungszweck: 'RE-2026-0021',
  stornoOfId: null,
  pdfDownloadUrl: null,
  issuedAt: '2026-11-01T10:00:00Z',
  lineItems: [],
} as unknown as Invoice;

function fakeInvoices(invoices: Invoice[] | 'error') {
  server.use(
    http.get('/api/bookings/:id/invoices', () =>
      invoices === 'error'
        ? HttpResponse.json({ message: 'boom' }, { status: 500 })
        : HttpResponse.json(invoices)
    )
  );
}

function renderDetail(b: Booking, onTransition = jest.fn(), lang: Locale = 'en') {
  const theme = 'light' as const;
  renderWithProviders(
    <BookingDetail
      booking={b}
      ctx={ctx}
      packageName="Family · 2 hours"
      clientBookingCount={1}
      subdomain="studio-berg"
      styles={getBookingsStyles(theme)}
      colors={getColors(theme)}
      theme={theme}
      isNarrow={false}
      actionError={null}
      onTransition={onTransition}
      onEdit={jest.fn()}
    />,
    { lang }
  );
  return onTransition;
}

describe('BookingDetail', () => {
  it('leads with "Record payment" before the shoot, and keeps "Mark completed" in the menu', async () => {
    fakeInvoices([openInvoice]);
    const user = setupUser();
    renderDetail(booking());

    expect(await screen.findByRole('button', { name: 'Record payment' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark completed' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menuitem', { name: 'Mark completed' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Cancel booking' })).toBeInTheDocument();
  });

  it('leads with "Mark completed" once the shoot date has passed', async () => {
    fakeInvoices([]);
    const user = setupUser();
    const onTransition = renderDetail(
      booking({ eventDate: '2026-11-05', paymentState: 'PAID', amountPaidCents: 115_000 })
    );

    await user.click(await screen.findByRole('button', { name: 'Mark completed' }));
    expect(onTransition).toHaveBeenCalledWith('COMPLETED');
  });

  it('answers an enquiry with confirm or decline', async () => {
    fakeInvoices([]);
    renderDetail(booking({ status: 'ENQUIRY', paymentState: 'NOT_INVOICED', amountPaidCents: 0 }));

    expect(await screen.findByRole('button', { name: 'Confirm booking' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline enquiry' })).toBeInTheDocument();
  });

  it('offers a retry instead of a dead end when the invoices cannot be loaded', async () => {
    fakeInvoices('error');
    const user = setupUser();
    renderDetail(booking());

    const retry = await screen.findByRole('button', { name: 'Retry' });
    fakeInvoices([openInvoice]);
    await user.click(retry);

    expect(await screen.findByText('RE-2026-0021')).toBeInTheDocument();
  });

  /**
   * A paid invoice withdrawn by a Storno with no replacement: the money stays
   * Collected, nothing asks for it, and the photographer has to see that they
   * are holding it. The payment state itself keeps its usual value.
   */
  it('shows the Credit the studio is holding for the client', async () => {
    fakeInvoices([]);
    renderDetail(
      booking({ paymentState: 'NOT_INVOICED', amountPaidCents: 100_000, creditCents: 100_050 })
    );

    expect(await screen.findByText('Credit €1,000.50')).toBeInTheDocument();
    expect(screen.getByText('Not invoiced')).toBeInTheDocument();
  });

  it('names the Credit in German too', async () => {
    fakeInvoices([]);
    renderDetail(
      booking({ paymentState: 'NOT_INVOICED', amountPaidCents: 100_000, creditCents: 100_050 }),
      jest.fn(),
      'de'
    );

    expect(await screen.findByText(/^Guthaben 1\.000,50\s€$/)).toBeInTheDocument();
  });

  it('shows no Credit while the Live invoices use up everything paid', async () => {
    fakeInvoices([openInvoice]);
    renderDetail(booking({ creditCents: 0 }));

    expect(await screen.findByText('RE-2026-0021')).toBeInTheDocument();
    expect(screen.queryByText(/Credit/)).toBeNull();
  });

  it('saves the note in place without sending a resource list it never loaded', async () => {
    fakeInvoices([]);
    const sent: Record<string, unknown>[] = [];
    server.use(
      http.patch('/api/bookings/:id', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        sent.push(body);
        return HttpResponse.json({ ...booking(), internalNotes: body.internalNotes });
      }),
      // useSaveBooking refreshes these after a save.
      http.get('/api/bookings/conflicts', () => HttpResponse.json({ conflicts: [] })),
      http.get('/api/clients', () => HttpResponse.json([]))
    );
    const user = setupUser();
    renderDetail(booking());

    const note = screen.getByLabelText(/Private note/);
    await user.clear(note);
    await user.type(note, 'Bring the step ladder.');
    await user.click(screen.getByRole('button', { name: 'Save note' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      internalNotes: 'Bring the step ladder.',
      clientName: 'Sophie & Luca Bauer',
      eventTime: '15:00',
      totalAmountCents: 115_000,
      assignedUserId: 'u-1',
    });
    expect(sent[0]).not.toHaveProperty('resourceIds');
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it("saves the Customer's language from the select, leaving the rest of the booking as it is", async () => {
    fakeInvoices([]);
    const sent: Record<string, unknown>[] = [];
    server.use(
      http.get('/api/photographerBookings', () => HttpResponse.json([booking({ language: 'de' })])),
      http.patch('/api/bookings/:id', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        sent.push(body);
        return HttpResponse.json({ ...booking(), language: body.language });
      }),
      http.get('/api/bookings/conflicts', () => HttpResponse.json({ conflicts: [] })),
      http.get('/api/clients', () => HttpResponse.json([]))
    );
    const user = setupUser();
    // As the page does: the detail shows the booking from the cached list, so
    // what it shows after the save is what useSaveBooking put there.
    function FromList() {
      const b = useBookings(true).data?.[0];
      return b ? (
        <BookingDetail
          booking={b}
          ctx={ctx}
          packageName={null}
          clientBookingCount={1}
          subdomain="studio-berg"
          styles={getBookingsStyles('light')}
          colors={getColors('light')}
          theme="light"
          isNarrow={false}
          actionError={null}
          onTransition={jest.fn()}
          onEdit={jest.fn()}
        />
      ) : null;
    }
    renderWithProviders(<FromList />, { lang: 'en' });

    const select = await screen.findByLabelText('Language of your emails');
    expect(select).toHaveValue('de');
    await user.selectOptions(select, 'en');

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      language: 'en',
      clientName: 'Sophie & Luca Bauer',
      internalNotes: 'Golden hour.',
      assignedUserId: 'u-1',
    });
    expect(sent[0]).not.toHaveProperty('resourceIds');
    await waitFor(() => expect(select).toBeEnabled());
    expect(select).toHaveValue('en');
  });

  it('says so when the language cannot be saved, and keeps the old one', async () => {
    fakeInvoices([]);
    server.use(http.patch('/api/bookings/:id', () => HttpResponse.json({}, { status: 500 })));
    const user = setupUser();
    renderDetail(booking({ language: 'en' }), jest.fn(), 'de');

    const select = screen.getByLabelText('Sprache Ihrer E-Mails');
    await user.selectOptions(select, 'de');

    expect(
      await screen.findByText('Die Sprache konnte nicht geändert werden.')
    ).toBeInTheDocument();
    expect(select).toHaveValue('en');
  });

  it('holds the language while the note is still saving, so it cannot send the old note back', async () => {
    fakeInvoices([]);
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.patch('/api/bookings/:id', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        await held;
        return HttpResponse.json({ ...booking(), internalNotes: body.internalNotes });
      }),
      http.get('/api/bookings/conflicts', () => HttpResponse.json({ conflicts: [] })),
      http.get('/api/clients', () => HttpResponse.json([]))
    );
    const user = setupUser();
    renderDetail(booking());

    const note = screen.getByLabelText(/Private note/);
    await user.clear(note);
    await user.type(note, 'Bring the step ladder.');
    await user.click(screen.getByRole('button', { name: 'Save note' }));

    const select = screen.getByLabelText('Language of your emails');
    await waitFor(() => expect(select).toBeDisabled());
    release();
    await waitFor(() => expect(select).toBeEnabled());
  });

  it('shows German for a booking whose language the API did not send', () => {
    fakeInvoices([]);
    renderDetail(booking());
    expect(screen.getByLabelText('Language of your emails')).toHaveValue('de');
  });
});
