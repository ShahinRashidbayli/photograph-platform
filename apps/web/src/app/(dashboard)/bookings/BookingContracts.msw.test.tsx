import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { useAuthStore } from '@/store/authStore';
import type { Contract } from '@/hooks/useContracts';
import type { Booking } from '@/types/api';
import { BookingContracts } from './BookingContracts';

/**
 * The contract panel's sends against a faked API.
 *
 * <p>Each send is one email to the Customer, so what matters is what goes out
 * with it — the Personal note, or nothing — that the button cannot be pressed
 * twice while the first request runs, and that "Erneut senden" is offered only
 * where the server accepts it: on a SENT contract.
 */
const booking = { id: 'bk-1', clientName: 'Sophie Bauer' } as Booking;

function contract(overrides: Partial<Contract>): Contract {
  return {
    id: 'ct-1',
    bookingId: 'bk-1',
    status: 'DRAFT',
    title: 'Fotografievertrag',
    body: 'Text',
    recipientName: 'Sophie Bauer',
    recipientEmail: 'sophie@example.test',
    issuerName: null,
    issuerAddress: null,
    issuerEmail: null,
    signerName: null,
    signedAt: null,
    sentAt: null,
    cancelledAt: null,
    createdAt: '2026-11-01T10:00:00Z',
    editable: true,
    intact: true,
    ...overrides,
  };
}

/** A request the test lets through when it chooses, so the pending state can be seen. */
function gate() {
  let open: () => void = () => {};
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { open, opened };
}

function fakeContracts(contracts: Contract[]) {
  server.use(
    http.get('/api/entitlements', () =>
      HttpResponse.json({ plan: 'STUDIO', capabilities: ['CONTRACTS'] })
    ),
    http.get('/api/bookings/bk-1/contracts', () => HttpResponse.json(contracts))
  );
}

/** Records each body posted to `path`, answering once `until` resolves. */
function recordPosts(path: string, answer: Contract, until?: Promise<void>, status = 200) {
  const bodies: unknown[] = [];
  server.use(
    http.post(path, async ({ request }) => {
      bodies.push(await request.json());
      if (until) await until;
      return status === 200
        ? HttpResponse.json(answer)
        : HttpResponse.json({ error: 'Mail is down' }, { status });
    })
  );
  return bodies;
}

beforeEach(() => {
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'anna@example.de',
      fullName: 'Anna',
      role: 'PHOTOGRAPHER',
      emailVerified: true,
      tenant: { subdomain: 'anna-foto', plan: 'STUDIO' },
    },
  });
});

afterEach(() => useAuthStore.setState({ user: null }));

describe('BookingContracts', () => {
  it('says a draft is a draft, not that it was sent', async () => {
    // Every status but SIGNED used to read "Gesendet an …", a draft included.
    fakeContracts([contract({})]);
    renderWithProviders(<BookingContracts booking={booking} theme="light" />, { lang: 'de' });

    expect(await screen.findByText('Entwurf für Sophie Bauer')).toBeInTheDocument();
    expect(screen.queryByText(/Gesendet an/)).toBeNull();
  });

  it('sends the contract with the Personal note typed into the dialog', async () => {
    fakeContracts([contract({})]);
    const bodies = recordPosts('/api/contracts/ct-1/send', contract({ status: 'SENT' }));
    const user = setupUser();
    renderWithProviders(<BookingContracts booking={booking} theme="light" />, { lang: 'de' });

    await user.click(await screen.findByRole('button', { name: 'An Kunden senden' }));
    const dialog = screen.getByRole('dialog', { name: 'Diesen Vertrag senden?' });
    await user.type(within(dialog).getByLabelText('Persönliche Notiz (optional)'), 'Bis bald!');
    expect(within(dialog).getByText('9 / 1000')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'An Kunden senden' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toEqual([{ note: 'Bis bald!' }]);
  });

  it('sends no note at all when the field is left empty', async () => {
    fakeContracts([contract({})]);
    const bodies = recordPosts('/api/contracts/ct-1/send', contract({ status: 'SENT' }));
    const user = setupUser();
    renderWithProviders(<BookingContracts booking={booking} theme="light" />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Send to client' }));
    await user.type(screen.getByLabelText('Personal note (optional)'), '   ');
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Send to client' })
    );

    await waitFor(() => expect(bodies).toEqual([{ note: null }]));
  });

  it('disables sending while the request runs, so a double click sends one email', async () => {
    fakeContracts([contract({})]);
    const { open, opened } = gate();
    const bodies = recordPosts('/api/contracts/ct-1/send', contract({ status: 'SENT' }), opened);
    const user = setupUser();
    renderWithProviders(<BookingContracts booking={booking} theme="light" />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Send to client' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Send to client' }));

    const pending = await within(dialog).findByRole('button', { name: 'Sending…' });
    expect(pending).toBeDisabled();
    await user.click(pending);
    expect(bodies).toHaveLength(1);

    open();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toHaveLength(1);
  });

  it('closes the dialog on failure and shows the error above the contracts', async () => {
    fakeContracts([contract({})]);
    recordPosts('/api/contracts/ct-1/send', contract({}), undefined, 500);
    const user = setupUser();
    renderWithProviders(<BookingContracts booking={booking} theme="light" />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Send to client' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Send to client' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Mail is down');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers "Erneut senden" only on a SENT contract', async () => {
    fakeContracts([
      contract({ id: 'ct-draft', title: 'Entwurf A' }),
      contract({ id: 'ct-sent', title: 'Gesendet B', status: 'SENT', editable: false }),
      contract({ id: 'ct-signed', title: 'Signiert C', status: 'SIGNED', editable: false }),
    ]);
    renderWithProviders(<BookingContracts booking={booking} theme="light" />, { lang: 'de' });

    const buttons = await screen.findAllByRole('button', { name: 'Erneut senden' });
    expect(buttons).toHaveLength(1);
    // The one button sits in the SENT contract's row, between its title and the next.
    const sentTitle = screen.getByText('Gesendet B');
    const signedTitle = screen.getByText('Signiert C');
    expect(
      sentTitle.compareDocumentPosition(buttons[0]) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      buttons[0].compareDocumentPosition(signedTitle) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('sends a SENT contract again with a note, through the resend endpoint', async () => {
    const sent = contract({ status: 'SENT', editable: false });
    fakeContracts([sent]);
    const { open, opened } = gate();
    const bodies = recordPosts('/api/contracts/ct-1/resend', sent, opened);
    const user = setupUser();
    renderWithProviders(<BookingContracts booking={booking} theme="light" />, { lang: 'de' });

    await user.click(await screen.findByRole('button', { name: 'Erneut senden' }));
    const dialog = screen.getByRole('dialog', { name: 'Diesen Vertrag erneut senden?' });
    await user.type(within(dialog).getByLabelText('Persönliche Notiz (optional)'), 'Noch einmal');
    await user.click(within(dialog).getByRole('button', { name: 'Erneut senden' }));

    expect(await within(dialog).findByRole('button', { name: 'Wird gesendet…' })).toBeDisabled();
    open();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toEqual([{ note: 'Noch einmal' }]);
  });
});
