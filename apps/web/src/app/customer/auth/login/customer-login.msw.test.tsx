import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import type { Locale } from '@/lib/i18n';
import CustomerLoginPage from './page';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

/**
 * A wrong sign-in code, through the real axios client and its interceptor.
 *
 * <p>The verify endpoint answers 401 for a wrong code. The interceptor read
 * that as an expired session and refreshed: the refresh's own error ("No
 * refresh token provided") replaced the real one, and when a session cookie
 * *was* present the refresh succeeded and replayed the guess, spending two of
 * the five attempts. `customer-login.test.tsx` mocks `api` away, so it could
 * not see either.
 */
function fakeApi() {
  const calls = { verify: 0, refresh: 0 };
  server.use(
    http.post(
      '/api/auth/customer/login-code/request',
      () => new HttpResponse(null, { status: 204 })
    ),
    http.post('/api/auth/customer/login-code/verify', () => {
      calls.verify += 1;
      return HttpResponse.json(
        { error: "That code isn't valid. Request a new one." },
        { status: 401 }
      );
    }),
    http.post('/api/auth/refresh', () => {
      calls.refresh += 1;
      return HttpResponse.json({ error: 'No refresh token provided' }, { status: 401 });
    })
  );
  return calls;
}

const COPY: Record<
  'en' | 'de',
  { email: string; send: string; code: string; submit: string; invalid: string }
> = {
  en: {
    email: 'Email address',
    send: 'Send me a code →',
    code: '6-digit code',
    submit: 'Sign in →',
    invalid: "That code isn't valid. Request a new one below.",
  },
  de: {
    email: 'E-Mail-Adresse',
    send: 'Code senden →',
    code: '6-stelliger Code',
    submit: 'Anmelden →',
    invalid: 'Dieser Code ist ungültig. Fordern Sie unten einen neuen an.',
  },
};

describe.each(['en', 'de'] as const)('a wrong sign-in code (%s)', (lang) => {
  const copy = COPY[lang];

  it('says the code is wrong, spends one attempt and never refreshes', async () => {
    const calls = fakeApi();
    const user = setupUser();
    renderWithProviders(<CustomerLoginPage />, { lang: lang as Locale });

    await user.type(screen.getByLabelText(copy.email), 'maria@example.test');
    await user.click(screen.getByRole('button', { name: copy.send }));
    await user.type(await screen.findByLabelText(copy.code), '123456');
    await user.click(screen.getByRole('button', { name: copy.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.invalid);
    expect(screen.queryByText(/refresh token/i)).not.toBeInTheDocument();
    expect(calls).toEqual({ verify: 1, refresh: 0 });
  });
});
