import React from 'react';
import { renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { useAuthStore } from '@/store/authStore';
import { bookingsQueryKey } from '@/hooks/useBookings';
import { useConvertLead, useUpdateLeadStatus } from '@/hooks/useLeads';
import { useAttention } from '@/hooks/useAttention';
import type { Lead } from '@/types/api';
import LeadsPage from './page';

jest.mock('next/navigation', () => ({
  usePathname: () => '/leads',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({}),
}));

/**
 * The leads inbox against a faked API.
 *
 * <p>The first case is the bug the move to hooks fixed: the inbox's action
 * errors were English sentences written into the hook, so a German-speaking
 * photographer was told "Could not reject the lead" in English.
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

function fakeInbox(leads: Lead[] = [LEAD]) {
  server.use(
    http.get('/api/leads', () => HttpResponse.json(leads)),
    http.get('/api/inquiries', () => HttpResponse.json([])),
    http.get('/api/leads/:id/activity', () => HttpResponse.json([]))
  );
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

describe('LeadsPage', () => {
  it('says why a reject failed in the photographer’s language', async () => {
    fakeInbox();
    server.use(http.patch('/api/leads/l1/status', () => HttpResponse.json({}, { status: 500 })));
    const user = setupUser();
    renderWithProviders(<LeadsPage />, { lang: 'de' });

    await user.click(await screen.findByRole('button', { name: /Ablehnen/ }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Lead ablehnen' })
    );

    expect(
      await screen.findByText(
        'Der Lead konnte nicht abgelehnt werden. Bitte versuchen Sie es erneut.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('marks a lead replied once the API confirms it', async () => {
    fakeInbox();
    server.use(
      http.patch('/api/leads/l1/status', () => HttpResponse.json({ ...LEAD, status: 'REPLIED' }))
    );
    const user = setupUser();
    renderWithProviders(<LeadsPage />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: /Mark replied/ }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Mark replied/ })).not.toBeInTheDocument()
    );
  });

  it('keeps the leads when only the inquiries fail', async () => {
    server.use(
      http.get('/api/leads', () => HttpResponse.json([LEAD])),
      http.get('/api/inquiries', () => HttpResponse.json({}, { status: 500 })),
      http.get('/api/leads/:id/activity', () => HttpResponse.json([]))
    );
    renderWithProviders(<LeadsPage />, { lang: 'en' });

    expect((await screen.findAllByText('Klara Weber')).length).toBeGreaterThan(0);
    expect(screen.queryByText("Couldn't load leads")).not.toBeInTheDocument();
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
