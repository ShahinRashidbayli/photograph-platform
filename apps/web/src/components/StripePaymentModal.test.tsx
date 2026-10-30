import React from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { StripePaymentModal } from './StripePaymentModal';
import type { Invoice, Payment } from '@/types/api';

/**
 * Stripe.js injects a cross-origin script and mounts an iframe, neither of
 * which jsdom can do. The parts under test here are all upstream of that: what
 * this component asks the API for, which answer it decides to mount Elements
 * on, and what it shows when it can't. `Elements` is reduced to a marker
 * carrying the client secret it was handed, which is exactly the fact each
 * assertion below is about.
 */
jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({
    children,
    options,
  }: {
    children: React.ReactNode;
    options: { clientSecret: string };
  }) => (
    <div data-testid="stripe-elements" data-client-secret={options.clientSecret}>
      {children}
    </div>
  ),
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: jest.fn() }),
  useElements: () => ({}),
}));

jest.mock('@/hooks/useInvoices', () => ({
  ...jest.requireActual('@/hooks/useInvoices'),
  createPaymentIntent: jest.fn(),
}));

import { createPaymentIntent } from '@/hooks/useInvoices';

const mockedCreateIntent = createPaymentIntent as jest.MockedFunction<typeof createPaymentIntent>;

const invoice: Invoice = {
  id: 'inv-1',
  bookingId: 'bk-1',
  invoiceNumber: '2026-0001',
  status: 'ISSUED',
  taxMode: 'REGELBESTEUERUNG',
  buyerName: 'Maria Kellner',
  buyerEmail: 'maria@example.test',
  currency: 'EUR',
  subtotalCents: 100_000,
  taxCents: 19_000,
  totalCents: 119_000,
  paidCents: 0,
  outstandingCents: 119_000,
  verwendungszweck: 'RE-2026-0001',
  stornoOfId: null,
  pdfDownloadUrl: null,
  issuedAt: '2026-08-01T10:00:00Z',
  lineItems: [],
};

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1',
    invoiceId: 'inv-1',
    method: 'CARD',
    status: 'PENDING',
    amountCents: 119_000,
    currency: 'EUR',
    clientSecret: 'pi_1_secret_abc',
    publishableKey: 'pk_test_123',
    stripeAccountId: 'acct_photographer',
    applicationFeeCents: 2380,
    createdAt: '2026-08-01T10:00:00Z',
    confirmedAt: null,
    ...overrides,
  };
}

function renderModal() {
  return renderWithProviders(
    <StripePaymentModal invoice={invoice} outstandingCents={119_000} onClose={jest.fn()} />,
    { lang: 'en' }
  );
}

beforeEach(() => {
  mockedCreateIntent.mockReset();
});

describe('StripePaymentModal', () => {
  it('mounts the card form on the intent the server returned', async () => {
    mockedCreateIntent.mockResolvedValue(payment());
    renderModal();

    const elements = await screen.findByTestId('stripe-elements');
    expect(elements).toHaveAttribute('data-client-secret', 'pi_1_secret_abc');
    expect(mockedCreateIntent).toHaveBeenCalledWith('inv-1', 'CARD');
  });

  /**
   * The amount charged is the intent's, not the caller's. They diverge exactly
   * when they matter most — a bank transfer recorded between opening the
   * booking screen and clicking Pay lowers the balance, and a button quoting
   * the stale figure asks for money that is no longer owed.
   */
  it('bills what the intent says, not what the caller passed in', async () => {
    mockedCreateIntent.mockResolvedValue(payment({ amountCents: 50_000 }));
    renderModal();

    expect(await screen.findByRole('heading', { name: /500\.00/ })).toBeInTheDocument();
  });

  /**
   * A client secret is unusable without the connected account it lives on —
   * these are direct charges, so the platform key alone cannot resolve it.
   * A partial response must fail visibly rather than mount a form that can
   * never confirm.
   */
  it('refuses a response missing the connected account', async () => {
    mockedCreateIntent.mockResolvedValue(payment({ stripeAccountId: null }));
    renderModal();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('stripe-elements')).not.toBeInTheDocument();
  });

  /**
   * The API's message explains *why* — an unconnected photographer, an invoice
   * already settled — where a generic line can only say it didn't work.
   */
  it('shows the API error rather than a generic one when the API wrote it', async () => {
    mockedCreateIntent.mockRejectedValue({
      response: {
        data: { error: 'This photographer has not finished setting up online payments' },
      },
    });
    renderModal();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /has not finished setting up online payments/
    );
  });

  it('falls back to its own message when the failure carries none', async () => {
    mockedCreateIntent.mockRejectedValue(new Error('network down'));
    renderModal();

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    // Never the raw exception text — that is for the console, not the payer.
    expect(alert).not.toHaveTextContent(/network down/);
  });

  /**
   * The reason `requestSeq` exists.
   *
   * <p>Switching method mints a new intent and cancels the previous one server
   * side. If a slow first response lands after a fast second, mounting it would
   * point Elements at an intent that has already been cancelled — and the payer
   * only finds out at submit, with "this PaymentIntent has a status of
   * canceled" and nothing on screen explaining it.
   */
  it('ignores a stale intent that resolves after a newer one', async () => {
    const user = setupUser();
    let releaseCard: (_p: Payment) => void = () => {};
    const slowCard = new Promise<Payment>((resolve) => {
      releaseCard = resolve;
    });

    mockedCreateIntent.mockImplementation((_id, method) =>
      method === 'CARD' ? slowCard : Promise.resolve(payment({ clientSecret: 'pi_sepa_secret' }))
    );

    renderModal();
    await user.click(screen.getByRole('button', { name: /SEPA/i }));

    const elements = await screen.findByTestId('stripe-elements');
    expect(elements).toHaveAttribute('data-client-secret', 'pi_sepa_secret');

    // The abandoned card request now completes. Flush its continuation before
    // asserting — `waitFor` would otherwise pass on its first poll, before the
    // stale `setIntent` had a chance to run, and the test would go green with
    // the sequencing guard deleted.
    await act(async () => {
      releaseCard(payment({ clientSecret: 'pi_card_secret' }));
      await slowCard;
    });

    expect(screen.getByTestId('stripe-elements')).toHaveAttribute(
      'data-client-secret',
      'pi_sepa_secret'
    );
  });

  it('asks for an intent in the method the payer picked', async () => {
    const user = setupUser();
    mockedCreateIntent.mockResolvedValue(payment());
    renderModal();

    await screen.findByTestId('stripe-elements');
    await user.click(screen.getByRole('button', { name: /SEPA/i }));

    await waitFor(() => expect(mockedCreateIntent).toHaveBeenCalledWith('inv-1', 'SEPA'));
  });
});
