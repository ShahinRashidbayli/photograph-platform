import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import RegisterPage from './page';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import api from '@/lib/api';

const mockedApi = api as jest.Mocked<typeof api>;

/** A sign-up that should sail through, so each test can spoil one thing. */
async function fillValidForm(user: ReturnType<typeof setupUser>) {
  await user.type(screen.getByLabelText('Full name'), 'Anna Fischer');
  await user.type(screen.getByLabelText('Email address'), 'anna@fotografie.de');
  await user.type(screen.getByLabelText('Your subdomain'), 'anna-foto');
  await user.type(screen.getByLabelText('Password'), 'Passwort1234');
  await user.type(screen.getByLabelText('Confirm password'), 'Passwort1234');
}

const submit = () => screen.getByRole('button', { name: 'Create studio' });

beforeEach(() => {
  push.mockReset();
  mockedApi.post.mockReset();
  mockedApi.get.mockReset();
  mockedApi.get.mockResolvedValue({
    data: { subdomain: 'anna-foto', available: true, reason: null },
  } as never);
});

describe('RegisterPage', () => {
  const render = () => renderWithProviders(<RegisterPage />, { lang: 'en' });

  /**
   * §5 DDG / DSGVO: consent has to be an explicit, unticked opt-in. The box
   * starting checked would make it no consent at all.
   */
  it('starts with consent unticked and refuses to submit without it', async () => {
    const user = setupUser();
    render();

    expect(screen.getByRole('checkbox')).not.toBeChecked();

    await fillValidForm(user);
    await user.click(submit());

    expect(
      await screen.findByText('Please accept the terms and the privacy policy to continue.')
    ).toBeInTheDocument();
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('links both documents at the point of consent', () => {
    render();

    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/agb');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/datenschutz'
    );
  });

  /**
   * A mistyped password on a form that signs you straight in is only discovered
   * at the *next* sign-in, when the only remedy left is a password reset.
   */
  it('catches a mistyped password before creating the account', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByLabelText('Full name'), 'Anna Fischer');
    await user.type(screen.getByLabelText('Email address'), 'anna@fotografie.de');
    await user.type(screen.getByLabelText('Your subdomain'), 'anna-foto');
    await user.type(screen.getByLabelText('Password'), 'Passwort1234');
    await user.type(screen.getByLabelText('Confirm password'), 'Passwort1235');
    await user.click(screen.getByRole('checkbox'));
    await user.click(submit());

    expect(await screen.findByText('The two passwords don’t match.')).toBeInTheDocument();
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('reports each bad field on the field itself, not as one banner', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.click(submit());

    await waitFor(() => {
      expect(screen.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true');
    });
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('clears a field’s complaint as soon as the user starts fixing it', async () => {
    const user = setupUser();
    render();

    await user.click(submit());
    await waitFor(() => {
      expect(screen.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true');
    });

    await user.type(screen.getByLabelText('Full name'), 'A');
    expect(screen.getByLabelText('Full name')).not.toHaveAttribute('aria-invalid');
  });

  /**
   * The subdomain is the one field whose validity the user cannot know in
   * advance. It used to be reported by a 409 after the whole form was filled in.
   */
  it('reports a taken subdomain while the user is still on the field', async () => {
    const user = setupUser();
    mockedApi.get.mockResolvedValue({
      data: { subdomain: 'anna-foto', available: false, reason: 'TAKEN' },
    } as never);
    render();

    await user.type(screen.getByLabelText('Your subdomain'), 'anna-foto');

    expect(
      await screen.findByText('That address is already taken. Try another.')
    ).toBeInTheDocument();
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('confirms a free subdomain by name', async () => {
    const user = setupUser();
    render();

    await user.type(screen.getByLabelText('Your subdomain'), 'anna-foto');

    expect(
      await screen.findByText('anna-foto.fotolio.de is free — it’s yours.')
    ).toBeInTheDocument();
  });

  /**
   * Availability is advisory. A failed check must not block a sign-up that the
   * server would have accepted — register still holds the unique constraint.
   */
  it('still allows submitting when the availability check itself fails', async () => {
    const user = setupUser();
    mockedApi.get.mockRejectedValue(new Error('network'));
    mockedApi.post.mockResolvedValue({
      data: { id: 'u1', role: 'PHOTOGRAPHER', emailVerified: false },
    } as never);
    render();

    await fillValidForm(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(submit());

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1));
  });

  it('tells the user to confirm their address instead of only redirecting', async () => {
    const user = setupUser();
    mockedApi.post.mockResolvedValue({
      data: { id: 'u1', role: 'PHOTOGRAPHER', emailVerified: false },
    } as never);
    render();

    await fillValidForm(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(submit());

    expect(await screen.findByText(/anna@fotografie\.de a confirmation link/)).toBeInTheDocument();
  });

  it('puts a lost race for the subdomain on the subdomain field', async () => {
    const user = setupUser();
    mockedApi.post.mockRejectedValue({
      response: { status: 409, data: { error: 'Subdomain already taken' } },
    });
    render();

    await fillValidForm(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(submit());

    await waitFor(() => {
      expect(screen.getByLabelText('Your subdomain')).toHaveAttribute('aria-invalid', 'true');
    });
    expect(screen.getByText('Subdomain already taken')).toBeInTheDocument();
  });
});
