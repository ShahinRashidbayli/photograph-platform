import React from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import CustomerLoginPage from './page';

let mockSearch = new URLSearchParams('');
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearch,
}));

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import api from '@/lib/api';

const mockedApi = api as jest.Mocked<typeof api>;

async function requestCode(user: ReturnType<typeof setupUser>) {
  await user.type(screen.getByLabelText('Email address'), 'maria@example.test');
  await user.click(screen.getByRole('button', { name: 'Send me a code →' }));
}

const resendButton = () => screen.getByRole('button', { name: /Send a new code|Resend in/ });

beforeEach(() => {
  mockedApi.post.mockReset();
  mockedApi.get.mockReset();
  mockSearch = new URLSearchParams('');
  window.localStorage.clear();
});

describe('CustomerLoginPage', () => {
  const render = () => renderWithProviders(<CustomerLoginPage />, { lang: 'en' });

  it('confirms the code was sent without confirming the account exists', async () => {
    const user = setupUser();
    mockedApi.post.mockResolvedValue({ status: 204 } as never);
    render();

    await requestCode(user);

    expect(await screen.findByText('Enter your code')).toBeInTheDocument();
    // "If a photographer has …" — the wording must stay conditional.
    expect(
      screen.getByText(/If a photographer has maria@example\.test on file/)
    ).toBeInTheDocument();
  });

  /**
   * Sign-in by email: nobody can be expected to know their photographer's
   * subdomain, so without a link the page asks for the address alone and the
   * server finds the studios that know it.
   */
  it('asks only for the email and lets the server find the studio', async () => {
    const user = setupUser();
    mockedApi.post.mockResolvedValue({ status: 204 } as never);
    render();

    expect(screen.queryByText('Photographer subdomain')).not.toBeInTheDocument();
    await requestCode(user);

    await screen.findByText('Enter your code');
    expect(mockedApi.post).toHaveBeenCalledWith(
      '/api/auth/customer/login-code/request',
      expect.objectContaining({ email: 'maria@example.test', subdomain: null })
    );
  });

  /**
   * The server allows five requests an hour. Without a hold, four impatient
   * clicks burn the allowance in ten seconds and the user then cannot ask again
   * for an hour.
   */
  it('holds the resend button after a code goes out', async () => {
    const user = setupUser();
    mockedApi.post.mockResolvedValue({ status: 204 } as never);
    render();

    await requestCode(user);

    const button = await waitFor(resendButton);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/Resend in \d+ seconds?/);
  });

  /**
   * The bug: every failure reported success, on the reasoning that the endpoint
   * is 204-always. That contract is about not revealing whether an address
   * exists; it says nothing about rate limits or an outage. So the button
   * claimed a code had been sent while nothing had, and the user waited for a
   * mail that was never coming.
   */
  it('does not claim a code was sent when the resend actually failed', async () => {
    // Fake timers so the test does not actually sit out the 30-second hold.
    // Installed before `setup`, and handed to userEvent, or its own internal
    // waits would never fire.
    jest.useFakeTimers();
    try {
      const user = setupUser({ advanceTimers: jest.advanceTimersByTime });
      mockedApi.post.mockResolvedValueOnce({ status: 204 } as never);
      render();
      await requestCode(user);
      await waitFor(resendButton);

      // Let the hold expire so the resend can be attempted at all.
      await act(async () => {
        jest.advanceTimersByTime(31_000);
      });
      expect(resendButton()).toBeEnabled();

      mockedApi.post.mockRejectedValueOnce(new Error('network down'));
      await user.click(resendButton());

      expect(
        await screen.findByText('Could not send another code. Please try again.')
      ).toBeInTheDocument();
      expect(screen.queryByText('Sent! Check your inbox again.')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  /**
   * The next thing this user does is switch to their email tab, and browsers
   * throttle background timers to roughly one tick a minute. A counter that
   * subtracts one per tick simply stops there, leaving them staring at "Resend
   * in 27 seconds" long after the wait is over — so the label is recomputed
   * from the clock instead.
   */
  it('recovers the countdown when a background tab has starved its timers', async () => {
    jest.useFakeTimers();
    try {
      const user = setupUser({ advanceTimers: jest.advanceTimersByTime });
      mockedApi.post.mockResolvedValue({ status: 204 } as never);
      render();
      await requestCode(user);
      await waitFor(resendButton);
      expect(resendButton()).toBeDisabled();

      // Time passes with no ticks delivered — exactly what a throttled tab does.
      act(() => {
        jest.setSystemTime(Date.now() + 31_000);
      });
      // A single tick on return is enough to catch up.
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      expect(resendButton()).toBeEnabled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports a rate limit as a wait, with the time the server gave', async () => {
    const user = setupUser();
    mockedApi.post.mockRejectedValue({
      response: {
        status: 429,
        data: { code: 'TOO_MANY_REQUESTS', details: { retryAfterSeconds: 600 } },
      },
    });
    render();

    await requestCode(user);

    expect(
      await screen.findByText(
        'You’ve already requested several codes. You can ask for another in 10 minutes.'
      )
    ).toBeInTheDocument();
  });

  it('falls back to a plain wait message when the server gave no duration', async () => {
    const user = setupUser();
    mockedApi.post.mockRejectedValue({
      response: { status: 429, data: { code: 'TOO_MANY_REQUESTS' } },
    });
    render();

    await requestCode(user);

    expect(
      await screen.findByText(
        'You’ve already requested several codes. Please wait a little before asking for another.'
      )
    ).toBeInTheDocument();
  });

  /**
   * A link from the studio already says who the photographer is. Asking the
   * client to type a subdomain they have never heard of is where first logins
   * failed; they see the studio's name instead, and can still change it.
   */
  describe('arriving from the studio’s link', () => {
    beforeEach(() => {
      mockSearch = new URLSearchParams('subdomain=studio-lichtblick');
      mockedApi.get.mockImplementation((url: string) =>
        url === '/api/public/legal/studio-lichtblick'
          ? Promise.resolve({
              data: { subdomain: 'studio-lichtblick', legalName: 'Lena Hoffmann' },
            } as never)
          : Promise.reject(new Error(`unexpected GET ${url}`))
      );
    });

    it('shows the studio instead of a subdomain field and signs in there', async () => {
      const user = setupUser();
      mockedApi.post.mockResolvedValue({ status: 204 } as never);
      render();

      expect(await screen.findByText('Lena Hoffmann')).toBeInTheDocument();
      expect(screen.getByText('studio-lichtblick.fotolio.de')).toBeInTheDocument();

      await user.type(screen.getByLabelText('Email address'), 'maria@example.test');
      await user.click(screen.getByRole('button', { name: 'Send me a code →' }));

      await screen.findByText('Enter your code');
      expect(mockedApi.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ subdomain: 'studio-lichtblick' })
      );
    });

    /** "Change" falls back to the email alone: every studio that knows the client. */
    it('lets the client drop the studio and sign in by email instead', async () => {
      const user = setupUser();
      mockedApi.post.mockResolvedValue({ status: 204 } as never);
      render();

      await user.click(await screen.findByRole('button', { name: 'Change' }));
      expect(screen.queryByText('Lena Hoffmann')).not.toBeInTheDocument();

      await requestCode(user);
      await screen.findByText('Enter your code');
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/api/auth/customer/login-code/request',
        expect.objectContaining({ subdomain: null })
      );
    });
  });

  /** A returning client sees their studio, not a subdomain they typed once and forgot. */
  it('remembers the studio this browser signed in to', async () => {
    window.localStorage.setItem('fotolio.customer.lastStudio', 'studio-lichtblick');
    mockedApi.get.mockImplementation((url: string) =>
      url === '/api/public/legal/studio-lichtblick'
        ? Promise.resolve({
            data: { subdomain: 'studio-lichtblick', legalName: 'Studio Lichtblick' },
          } as never)
        : Promise.reject(new Error(`unexpected GET ${url}`))
    );
    render();

    expect(await screen.findByText('Studio Lichtblick')).toBeInTheDocument();
    expect(screen.getByText('SL')).toBeInTheDocument();
  });

  /**
   * A Customer message links to the sign-in with the page it is about in
   * `next`. Signing in used to drop it and land on the bookings list, so the
   * contract the email promised was nowhere to be seen.
   */
  describe('after signing in from a link', () => {
    const realLocation = Object.getOwnPropertyDescriptor(globalThis, 'location')!;

    /** jsdom refuses navigation; the stub records where the page sent us. */
    function stubLocation(search: string) {
      Object.defineProperty(globalThis, 'location', {
        value: {
          href: '',
          search,
          origin: 'https://app.fotolio.de',
          hostname: 'app.fotolio.de',
        },
        writable: true,
        configurable: true,
      });
    }

    afterEach(() => {
      Object.defineProperty(globalThis, 'location', realLocation);
    });

    async function signInFrom(search: string) {
      mockSearch = new URLSearchParams(search);
      stubLocation(search);
      const user = setupUser();
      mockedApi.post.mockResolvedValue({ status: 200, data: {} } as never);
      render();

      await requestCode(user);
      await user.type(await screen.findByLabelText('6-digit code'), '123456');
      await user.click(screen.getByRole('button', { name: 'Sign in →' }));
      await waitFor(() => expect(globalThis.location.href).not.toBe(''));
      return globalThis.location.href;
    }

    it('lands on the page the link pointed to', async () => {
      expect(await signInFrom('?next=%2Fdocuments%3Fid%3Dx')).toBe('/documents?id=x');
    });

    it('lands on the bookings when the link named no page', async () => {
      expect(await signInFrom('')).toBe('/bookings');
    });

    /** `next` is in the query string, so anyone can write a link with their own. */
    it.each([['//evil.example'], ['https://evil.example'], ['/\\evil.example']])(
      'refuses to leave the site for %s',
      async (target) => {
        expect(await signInFrom(`?next=${encodeURIComponent(target)}`)).toBe('/bookings');
      }
    );
  });

  /** The message was sent to this address, so the Customer should not have to type it. */
  it('prefills the email and the studio from the link', async () => {
    mockSearch = new URLSearchParams('subdomain=studio-lichtblick&email=maria%40example.test');
    mockedApi.get.mockResolvedValue({
      data: { subdomain: 'studio-lichtblick', legalName: 'Lena Hoffmann' },
    } as never);
    render();

    expect(await screen.findByText('Lena Hoffmann')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveValue('maria@example.test');
  });
});
