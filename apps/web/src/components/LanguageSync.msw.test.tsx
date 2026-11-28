import React from 'react';
import { act, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { useAuthStore, type AuthUser } from '@/store/authStore';
import { useLangStore } from '@/store/langStore';
import { LanguageSync } from './LanguageSync';

/**
 * The stored language follows the one on screen, so the emails Fotolio writes
 * on the server are in the language the user reads the app in (#126).
 */
const USER: AuthUser = {
  id: 'u1',
  email: 'anna@example.test',
  fullName: 'Anna',
  role: 'PHOTOGRAPHER',
  emailVerified: true,
  tenant: { subdomain: 'anna-foto', plan: 'STARTER' },
  language: 'de',
};

function fakeApi() {
  const saved: unknown[] = [];
  server.use(
    http.patch('/api/auth/me', async ({ request }) => {
      const body = (await request.json()) as { language: 'de' | 'en' };
      saved.push(body);
      return HttpResponse.json({ ...USER, language: body.language });
    })
  );
  return saved;
}

describe('LanguageSync', () => {
  afterEach(() => useAuthStore.setState({ user: null }));

  it('saves the language on screen when the stored one differs', async () => {
    const saved = fakeApi();
    useAuthStore.setState({ user: USER });

    renderWithProviders(<LanguageSync />, { lang: 'en' });

    await waitFor(() => expect(saved).toEqual([{ language: 'en' }]));
    await waitFor(() => expect(useAuthStore.getState().user?.language).toBe('en'));
  });

  it('saves nothing while they agree', async () => {
    const saved = fakeApi();
    useAuthStore.setState({ user: USER });

    renderWithProviders(<LanguageSync />, { lang: 'de' });

    // Give a stray request time to land before asserting there was none.
    await new Promise((r) => setTimeout(r, 50));
    expect(saved).toEqual([]);
  });

  it('saves a switch made while signed in', async () => {
    const saved = fakeApi();
    useAuthStore.setState({ user: USER });
    renderWithProviders(<LanguageSync />, { lang: 'de' });

    act(() => useLangStore.getState().setLang('en'));

    await waitFor(() => expect(saved).toEqual([{ language: 'en' }]));
  });

  it('asks nothing while no one is signed in', async () => {
    const saved = fakeApi();

    renderWithProviders(<LanguageSync />, { lang: 'en' });

    await new Promise((r) => setTimeout(r, 50));
    expect(saved).toEqual([]);
  });
});
