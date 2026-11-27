import React from 'react';
import { act, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { useAuthStore } from '@/store/authStore';
import { bookingsQueryKey } from '@/hooks/useBookings';
import { useConvertLead, useUpdateLeadStatus } from '@/hooks/useLeads';
import { useAttention } from '@/hooks/useAttention';
import type { Lead } from '@/types/api';
import type { Inquiry } from './inquiryTypes';
import LeadsPage from './page';
import { UNDO_WINDOW_MS } from './useDeferredStatus';

jest.mock('next/navigation', () => ({
  usePathname: () => '/leads',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({}),
}));

/**
 * The leads inbox against a faked API.
 *
 * <p>Errors are shown in the photographer's language: they used to be English
 * sentences written into the hook, so a German-speaking photographer was told
 * "Could not reject the lead" in English.
 */
const LEAD: Lead = {
  id: 'l1',
  name: 'Klara Weber',
  email: 'klara@example.de',
  message: 'Hochzeit im Juni',
  eventDate: '2027-06-12',
  eventType: 'WEDDING',
  budgetRange: 'OVER_1000',
  score: 'HIGH',
  status: 'NEW',
  createdAt: '2026-10-20T10:00:00Z',
};

function fakeInbox(leads: Lead[] = [LEAD], bookings: unknown[] = []) {
  server.use(
    http.get('/api/leads', () => HttpResponse.json(leads)),
    http.get('/api/inquiries', () => HttpResponse.json([])),
    http.get('/api/leads/:id/activity', () => HttpResponse.json([])),
    http.get('/api/photographerBookings', () => HttpResponse.json(bookings))
  );
}

/** Records every status the page sends, answering with the lead in that status. */
function recordStatus(fail = false) {
  const sent: string[] = [];
  server.use(
    http.patch('/api/leads/l1/status', async ({ request }) => {
      const { status } = (await request.json()) as { status: Lead['status'] };
      sent.push(status);
      return fail ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json({ ...LEAD, status });
    })
  );
  return sent;
}

// jsdom has no matchMedia; the inbox asks it whether to split into list/detail panes.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Reply and decline are real mailto/wa.me links. jsdom cannot navigate to
// them, so the default is stopped here — the click handlers still run.
function stopDraftNavigation(e: MouseEvent) {
  const a = (e.target as Element | null)?.closest?.('a');
  if (a && /^(mailto:|https:\/\/wa\.me)/.test(a.getAttribute('href') ?? '')) e.preventDefault();
}

beforeEach(() => {
  document.addEventListener('click', stopDraftNavigation);
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

afterEach(() => {
  document.removeEventListener('click', stopDraftNavigation);
  useAuthStore.setState({ user: null });
  jest.useRealTimers();
});

/**
 * The inbox: a request is answered from a draft in one click, moves on at
 * once, and can be taken back for a few seconds — the server only hears of it
 * when that window has passed, because it cannot undo a reply itself.
 */
describe('LeadsPage', () => {
  it('answers by email and tells the server only once the undo window has passed', async () => {
    jest.useFakeTimers();
    fakeInbox();
    const sent = recordStatus();
    const user = setupUser({ advanceTimers: jest.advanceTimersByTime });
    renderWithProviders(<LeadsPage />, { lang: 'en' });

    const reply = await screen.findByRole('link', { name: 'Reply by email' });
    expect(reply.getAttribute('href')).toMatch(/^mailto:klara@example\.de\?subject=/);
    await user.click(reply);

    expect(
      screen.getByText('Draft opened · Klara Weber moved to “Waiting for client”')
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Waiting for client' })).toBeInTheDocument();
    expect(sent).toEqual([]);

    await act(async () => {
      jest.advanceTimersByTime(UNDO_WINDOW_MS);
    });
    await waitFor(() => expect(sent).toEqual(['REPLIED']));
    // Let the server's answer land inside act, so the row settling after it
    // is part of this test rather than a stray update after it.
    await act(async () => {
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => jest.requireActual('timers').setImmediate(resolve));
      }
    });
    expect(screen.getByRole('region', { name: 'Waiting for client' })).toBeInTheDocument();
  });

  it('takes a reply back without ever telling the server', async () => {
    jest.useFakeTimers();
    fakeInbox();
    const sent = recordStatus();
    const user = setupUser({ advanceTimers: jest.advanceTimersByTime });
    renderWithProviders(<LeadsPage />, { lang: 'en' });

    await user.click(await screen.findByRole('link', { name: 'Reply by email' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await act(async () => {
      jest.advanceTimersByTime(UNDO_WINDOW_MS * 2);
    });

    expect(sent).toEqual([]);
    expect(screen.getByRole('link', { name: 'Reply by email' })).toBeInTheDocument();
  });

  it('says why a reply failed in the photographer’s language', async () => {
    jest.useFakeTimers();
    fakeInbox();
    recordStatus(true);
    const user = setupUser({ advanceTimers: jest.advanceTimersByTime });
    renderWithProviders(<LeadsPage />, { lang: 'de' });

    await user.click(await screen.findByRole('link', { name: 'Per E-Mail antworten' }));
    await act(async () => {
      jest.advanceTimersByTime(UNDO_WINDOW_MS);
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/beantwortet/);
    // Back where it was: the reply never landed.
    expect(await screen.findByRole('link', { name: 'Per E-Mail antworten' })).toBeInTheDocument();
  });

  it('says when the studio is already booked on the requested day', async () => {
    fakeInbox(
      [LEAD],
      [
        {
          id: 'b1',
          clientName: 'Anna Schneider',
          clientEmail: 'anna@example.test',
          eventDate: '2027-06-12',
          eventTime: '10:00:00',
          eventType: 'Portrait',
          totalAmountCents: 0,
          depositAmountCents: 0,
          status: 'CONFIRMED',
          createdAt: '2026-10-01T00:00:00Z',
        },
      ]
    );
    renderWithProviders(<LeadsPage />, { lang: 'en' });

    expect(
      await screen.findByText('Busy that day: Anna Schneider · Portrait · 10:00')
    ).toBeInTheDocument();
  });

  it('keeps the leads when only the inquiries fail', async () => {
    server.use(
      http.get('/api/leads', () => HttpResponse.json([LEAD])),
      http.get('/api/inquiries', () => HttpResponse.json({}, { status: 500 })),
      http.get('/api/leads/:id/activity', () => HttpResponse.json([])),
      http.get('/api/photographerBookings', () => HttpResponse.json([]))
    );
    renderWithProviders(<LeadsPage />, { lang: 'en' });

    expect((await screen.findAllByText('Klara Weber')).length).toBeGreaterThan(0);
    expect(screen.queryByText("Couldn't load leads")).not.toBeInTheDocument();
  });
});

/**
 * A client's request is decided in the Personal note dialog: the server emails
 * them with the decision, so the note goes with it and there is no draft to
 * open — and no undo window, since the dialog is the moment to reconsider.
 */
describe('the request decision', () => {
  const INQUIRY: Inquiry = {
    id: 'i1',
    customerName: 'Jonas Richter',
    customerEmail: 'jonas@example.de',
    eventType: 'HOCHZEIT',
    budgetRange: '1000_2000',
    proposedDate: '2027-05-08',
    location: null,
    message: 'Standesamt im Mai',
    score: 'MED',
    status: 'PENDING',
    source: 'PORTAL',
    createdAt: '2026-10-21T10:00:00Z',
  };

  /** Records each status body, answering once `until` resolves. */
  function fakeRequests(until?: Promise<void>) {
    const bodies: unknown[] = [];
    server.use(
      http.get('/api/leads', () => HttpResponse.json([])),
      http.get('/api/inquiries', () => HttpResponse.json([INQUIRY])),
      http.get('/api/photographerBookings', () => HttpResponse.json([])),
      http.patch('/api/inquiries/i1/status', async ({ request }) => {
        const body = (await request.json()) as { status: Inquiry['status'] };
        bodies.push(body);
        if (until) await until;
        return HttpResponse.json({ ...INQUIRY, status: body.status });
      })
    );
    return bodies;
  }

  it('accepts with the Personal note typed into the dialog', async () => {
    const bodies = fakeRequests();
    const user = setupUser();
    renderWithProviders(<LeadsPage />, { lang: 'de' });

    await user.click(await screen.findByRole('button', { name: 'Anfrage annehmen' }));
    const dialog = screen.getByRole('dialog', { name: 'Diese Anfrage annehmen?' });
    await user.type(
      within(dialog).getByLabelText('Persönliche Notiz (optional)'),
      'Ich freue mich!'
    );
    expect(within(dialog).getByText('15 / 1000')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Annehmen und senden' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toEqual([{ status: 'ACCEPTED', note: 'Ich freue mich!' }]);
  });

  it('declines through the dialog at once, with no note when none is written', async () => {
    const bodies = fakeRequests();
    const user = setupUser();
    renderWithProviders(<LeadsPage />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Decline politely' }));
    const dialog = screen.getByRole('dialog', { name: 'Decline this request?' });
    await user.click(within(dialog).getByRole('button', { name: 'Decline and send' }));

    await waitFor(() => expect(bodies).toEqual([{ status: 'REJECTED', note: null }]));
  });

  it('disables the decision while the request runs, so a double click sends one email', async () => {
    let open: () => void = () => {};
    const bodies = fakeRequests(new Promise<void>((resolve) => (open = resolve)));
    const user = setupUser();
    renderWithProviders(<LeadsPage />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Accept request' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Accept and send' }));

    const pending = await within(dialog).findByRole('button', { name: 'Sending…' });
    expect(pending).toBeDisabled();
    await user.click(pending);
    expect(bodies).toHaveLength(1);

    open();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toHaveLength(1);
  });

  it('closes the dialog on failure and shows the error above the inbox', async () => {
    fakeRequests();
    server.use(
      http.patch('/api/inquiries/i1/status', () =>
        HttpResponse.json({ error: 'Mail is down' }, { status: 500 })
      )
    );
    const user = setupUser();
    renderWithProviders(<LeadsPage />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Accept request' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Accept and send' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Mail is down');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('useConvertLead', () => {
  it('marks the bookings list stale, so "View in bookings" shows the new one', async () => {
    server.use(
      http.post('/api/leads/l1/convert', () => HttpResponse.json({ id: 'b1' })),
      http.get('/api/leads', () => HttpResponse.json([]))
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(bookingsQueryKey(true), []);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useConvertLead(), { wrapper });

    await result.current.mutateAsync({
      id: 'l1',
      payload: {
        eventTime: null,
        location: null,
        packageId: null,
        totalAmountCents: null,
        depositAmountCents: null,
        internalNotes: null,
      },
    });

    expect(client.getQueryState(bookingsQueryKey(true))?.isInvalidated).toBe(true);
  });
});

describe('the bell follows the inbox', () => {
  /** It used to update only on its next 60s poll, or when the panel itself asked. */
  it('drops a lead from the count as soon as it is marked replied anywhere', async () => {
    let status: Lead['status'] = 'NEW';
    server.use(
      http.get('/api/leads', () => HttpResponse.json(status === 'NEW' ? [LEAD] : [])),
      http.get('/api/inquiries', () => HttpResponse.json([])),
      http.patch('/api/leads/l1/status', () => {
        status = 'REPLIED';
        return HttpResponse.json({ ...LEAD, status });
      })
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({ bell: useAttention(true), mark: useUpdateLeadStatus() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.bell.count).toBe(1));

    await result.current.mark.mutateAsync({ id: 'l1', status: 'REPLIED' });

    await waitFor(() => expect(result.current.bell.count).toBe(0));
  });
});
