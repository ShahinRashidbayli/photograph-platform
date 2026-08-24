import React from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import CustomerLoginPage from './page';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import api from '@/lib/api';

const mockedApi = api as jest.Mocked<typeof api>;

async function requestLink(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email address'), 'maria@example.test');
  await user.type(screen.getByLabelText('Photographer subdomain'), 'anna-foto');
  await user.click(screen.getByRole('button', { name: 'Send me a magic link →' }));
}

const resendButton = () => screen.getByRole('button', { name: /Resend/ });

beforeEach(() => {
  mockedApi.post.mockReset();
});

describe('CustomerLoginPage', () => {
  const render = () => renderWithProviders(<CustomerLoginPage />, { lang: 'en' });

  it('confirms the link was sent without confirming the account exists', async () => {
    const user = userEvent.setup();
    mockedApi.post.mockResolvedValue({ status: 204 } as never);
    render();

    await requestLink(user);

    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
    // "If … is registered" — the wording must stay conditional.
    expect(screen.getByText(/If maria@example\.test is registered/)).toBeInTheDocument();
  });

  /**
   * The server allows five requests an hour. Without a hold, four impatient
   * clicks burn the allowance in ten seconds and the user then cannot ask again
   * for an hour.
   */
  it('holds the resend button after a link goes out', async () => {
    const user = userEvent.setup();
    mockedApi.post.mockResolvedValue({ status: 204 } as never);
    render();

    await requestLink(user);

    const button = await waitFor(resendButton);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/Resend in \d+ seconds?/);
  });

  /**
   * The bug: every failure reported success, on the reasoning that the endpoint
   * is 204-always. That contract is about not revealing whether an address
   * exists; it says nothing about rate limits or an outage. So the button
   * claimed a link had been sent while nothing had, and the user waited for a
   * mail that was never coming.
   */
  it('does not claim a link was sent when the resend actually failed', async () => {
    // Fake timers so the test does not actually sit out the 30-second hold.
    // Installed before `setup`, and handed to userEvent, or its own internal
    // waits would never fire.
    jest.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      mockedApi.post.mockResolvedValueOnce({ status: 204 } as never);
      render();
      await requestLink(user);
      await waitFor(resendButton);

      // Let the hold expire so the resend can be attempted at all.
      await act(async () => {
        jest.advanceTimersByTime(31_000);
      });
      expect(resendButton()).toBeEnabled();

      mockedApi.post.mockRejectedValueOnce(new Error('network down'));
      await user.click(resendButton());

      expect(
        await screen.findByText('Could not send another link. Please try again.')
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
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      mockedApi.post.mockResolvedValue({ status: 204 } as never);
      render();
      await requestLink(user);
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
    const user = userEvent.setup();
    mockedApi.post.mockRejectedValue({
      response: {
        status: 429,
        data: { code: 'TOO_MANY_REQUESTS', details: { retryAfterSeconds: 600 } },
      },
    });
    render();

    await requestLink(user);

    expect(
      await screen.findByText(
        'You’ve already requested several links. You can ask for another in 10 minutes.'
      )
    ).toBeInTheDocument();
  });

  it('falls back to a plain wait message when the server gave no duration', async () => {
    const user = userEvent.setup();
    mockedApi.post.mockRejectedValue({
      response: { status: 429, data: { code: 'TOO_MANY_REQUESTS' } },
    });
    render();

    await requestLink(user);

    expect(
      await screen.findByText(
        'You’ve already requested several links. Please wait a little before asking for another.'
      )
    ).toBeInTheDocument();
  });
});
