import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import RequestForm from './RequestForm';

/**
 * The public request form was English-only — "YOUR NAME *", "Under €200" —
 * on a studio page whose visitors are mostly German, and the landing page now
 * pictures it in the visitor's language. These pin that it speaks both, and
 * that budget amounts go through the locale formatter rather than a typed "€".
 */
describe('RequestForm', () => {
  it('asks in German, with German amounts', () => {
    renderWithProviders(<RequestForm subdomain="studio-berg" />, { lang: 'de' });

    expect(screen.getByLabelText('Ihr Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Art des Shootings *')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Hochzeit' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^Unter 200\s€$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Anfrage senden/ })).toBeInTheDocument();
  });

  it('asks in English, with English amounts', () => {
    renderWithProviders(<RequestForm subdomain="studio-berg" />, { lang: 'en' });

    expect(screen.getByLabelText('Your name *')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '€200 – €500' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Over €1,000' })).toBeInTheDocument();
  });
});
