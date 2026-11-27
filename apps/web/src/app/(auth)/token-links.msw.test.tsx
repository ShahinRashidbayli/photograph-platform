import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import InvitePage from './invite/page';
import ResetPasswordPage from './reset-password/page';
import VerifyEmailPage from './verify-email/page';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=spent-token'),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

/**
 * Used or unknown links, through the real axios client and its interceptor.
 *
 * <p>Each of these endpoints answers 401 for a dead token. The interceptor took
 * that for an expired session, refreshed, and when the refresh failed sent the
 * visitor to `/login?next=…` — so the page's own "this link is no longer valid"
 * state never appeared. A refresh call is the failure, so every test asserts
 * there was none.
 */
let refreshes = 0;
const DEAD_LINK = { status: 401 } as const;

beforeEach(() => {
  refreshes = 0;
  server.use(
    http.post('/api/auth/refresh', () => {
      refreshes += 1;
      return HttpResponse.json({ error: 'No refresh token provided' }, DEAD_LINK);
    })
  );
});

afterEach(() => {
  expect(refreshes).toBe(0);
});

it('a used reset link shows the reset page’s invalid-link message', async () => {
  server.use(
    http.post('/api/auth/password/reset', () =>
      HttpResponse.json({ error: 'Invalid or expired reset link' }, DEAD_LINK)
    )
  );
  const user = setupUser();
  renderWithProviders(<ResetPasswordPage />, { lang: 'en' });

  await user.type(screen.getByLabelText('New password'), 'correct-horse-battery-9');
  await user.type(screen.getByLabelText('Confirm new password'), 'correct-horse-battery-9');
  await user.click(screen.getByRole('button', { name: 'Update password' }));

  expect(
    await screen.findByText('This reset link is no longer valid. Request a new one and try again.')
  ).toBeInTheDocument();
});

it('a used verification link shows the translated invalid-link message', async () => {
  server.use(
    http.post('/api/auth/verify-email', () =>
      HttpResponse.json({ error: 'Invalid or expired verification link' }, DEAD_LINK)
    )
  );
  renderWithProviders(<VerifyEmailPage />, { lang: 'de' });

  expect(
    await screen.findByText(
      'Dieser Bestätigungslink ist ungültig oder abgelaufen. Im Dashboard können Sie einen neuen anfordern.'
    )
  ).toBeInTheDocument();
  expect(screen.queryByText('Invalid or expired verification link')).not.toBeInTheDocument();
});

it('an unknown invitation link shows the invitation’s invalid state', async () => {
  server.use(
    http.get('/api/public/invitations', () =>
      HttpResponse.json({ error: 'Invalid or expired invitation' }, DEAD_LINK)
    )
  );
  renderWithProviders(<InvitePage />, { lang: 'en' });

  expect(await screen.findByText('This invitation is no longer valid')).toBeInTheDocument();
});

it('an invitation spent before submitting shows the invitation’s invalid state', async () => {
  let accepts = 0;
  server.use(
    http.get('/api/public/invitations', () =>
      HttpResponse.json({ studioName: 'Studio Licht', email: 'anna@example.test' })
    ),
    http.post('/api/public/invitations/accept', () => {
      accepts += 1;
      return HttpResponse.json({ error: 'Invalid or expired invitation' }, DEAD_LINK);
    })
  );
  const user = setupUser();
  renderWithProviders(<InvitePage />, { lang: 'en' });

  await user.type(await screen.findByLabelText('Your name'), 'Anna Berg');
  await user.type(screen.getByLabelText('Choose a password'), 'correct-horse-battery-9');
  await user.click(screen.getByRole('button', { name: 'Join the studio' }));

  expect(await screen.findByText('This invitation is no longer valid')).toBeInTheDocument();
  await waitFor(() => expect(accepts).toBe(1));
});
