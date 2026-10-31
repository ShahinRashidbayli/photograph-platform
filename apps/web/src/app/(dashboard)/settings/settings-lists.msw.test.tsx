import React from 'react';
import { renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { useAuthStore } from '@/store/authStore';
import { usePackages, useSavePackage, type PackagePayload } from '@/hooks/usePackages';
import type { Package } from '@/types/api';
import { PackagesSection } from './PackagesSection';
import { ResourceSettings } from './ResourceSettings';
import { TeamSettings } from './TeamSettings';

/**
 * Packages, resources and team against a faked API.
 *
 * <p>These three lists are also read by the booking form. Since they moved onto
 * shared query keys, a write here has to reach that form as well — that is the
 * case at the bottom. The first case is a bug the move fixed: a failed package
 * delete was written into the edit form's error, which cannot be open while
 * Delete is clickable.
 */
const PKG: Package = {
  id: 'p1',
  name: 'Hochzeit Basic',
  priceCents: 120000,
  currency: 'EUR',
  active: true,
  sortOrder: 0,
};

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

describe('PackagesSection', () => {
  it('says so when a delete fails, and closes the dialog', async () => {
    server.use(
      http.get('/api/packages', () => HttpResponse.json([PKG])),
      http.delete('/api/packages/p1', () => HttpResponse.json({}, { status: 500 }))
    );
    const user = setupUser();
    renderWithProviders(<PackagesSection theme="light" />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' })
    );

    expect(await screen.findByText('Could not delete the package.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows a created package once the list has been re-read', async () => {
    let packages: Package[] = [];
    server.use(
      http.get('/api/packages', () => HttpResponse.json(packages)),
      http.post('/api/packages', async ({ request }) => {
        const body = (await request.json()) as PackagePayload;
        packages = [{ ...PKG, name: body.name, priceCents: body.priceCents }];
        return HttpResponse.json(packages[0]);
      })
    );
    const user = setupUser();
    renderWithProviders(<PackagesSection theme="light" />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: /Add package/ }));
    await user.type(screen.getByLabelText('Package name *'), 'Portrait');
    await user.type(screen.getByLabelText('Price (€) *'), '250');
    await user.click(screen.getByRole('button', { name: 'Create package' }));

    expect(await screen.findByText('Portrait')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create package' })).not.toBeInTheDocument();
  });
});

describe('ResourceSettings', () => {
  it('retires a resource and shows it with "Bring back"', async () => {
    let active = true;
    server.use(
      http.get('/api/resources', () =>
        HttpResponse.json([{ id: 'r1', name: 'Studio A', kind: 'ROOM', notes: null, active }])
      ),
      http.put('/api/resources/r1', async ({ request }) => {
        active = ((await request.json()) as { active: boolean }).active;
        return HttpResponse.json({});
      })
    );
    const user = setupUser();
    renderWithProviders(<ResourceSettings />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Retire' }));

    expect(await screen.findByRole('button', { name: 'Bring back' })).toBeInTheDocument();
    expect(active).toBe(false);
  });

  it('keeps the typed name when adding fails', async () => {
    server.use(
      http.get('/api/resources', () => HttpResponse.json([])),
      http.post('/api/resources', () => HttpResponse.json({}, { status: 500 }))
    );
    const user = setupUser();
    renderWithProviders(<ResourceSettings />, { lang: 'en' });

    const field = await screen.findByLabelText('Add a room or a piece of kit');
    await user.type(field, 'Profoto B10');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Could not add that.')).toBeInTheDocument();
    expect(field).toHaveValue('Profoto B10');
  });
});

describe('TeamSettings', () => {
  it('lists an invitation once it has been sent', async () => {
    let invitations: unknown[] = [];
    server.use(
      http.get('/api/entitlements', () =>
        HttpResponse.json({
          plan: 'STUDIO',
          capabilities: [],
          galleryRetentionDays: 730,
          seats: 3,
          commissionBps: 0,
          writable: true,
        })
      ),
      http.get('/api/team', () =>
        HttpResponse.json({
          members: [
            {
              id: 'u1',
              email: 'anna@example.de',
              fullName: 'Anna',
              staffRole: 'OWNER',
              avatarUrl: null,
            },
          ],
          invitations,
          seatsUsed: 1 + invitations.length,
          seatsTotal: 3,
          canManage: true,
        })
      ),
      http.post('/api/team/invitations', async ({ request }) => {
        const { email } = (await request.json()) as { email: string };
        invitations = [
          {
            id: 'i1',
            email,
            status: 'PENDING',
            expiresAt: '2026-12-01T00:00:00Z',
            createdAt: '2026-11-01T00:00:00Z',
          },
        ];
        return HttpResponse.json({});
      })
    );
    const user = setupUser();
    renderWithProviders(<TeamSettings />, { lang: 'en' });

    await user.type(await screen.findByLabelText('Invite a photographer'), 'ben@studio.de');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('Invitation sent to ben@studio.de.')).toBeInTheDocument();
    expect(screen.getByText('ben@studio.de')).toBeInTheDocument();
  });
});

describe('the booking form sees what Settings writes', () => {
  it('refetches the active-only package list after a save', async () => {
    let reads = 0;
    server.use(
      http.get('/api/packages', () => {
        reads += 1;
        return HttpResponse.json([PKG]);
      }),
      http.post('/api/packages', () => HttpResponse.json(PKG))
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    // The booking form's view and the save, in one tree.
    const { result } = renderHook(
      () => ({ bookingForm: usePackages({ activeOnly: true }), save: useSavePackage() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.bookingForm.isSuccess).toBe(true));
    expect(reads).toBe(1);

    await result.current.save.mutateAsync({ payload: { name: 'x' } as PackagePayload });

    expect(reads).toBe(2);
  });
});
