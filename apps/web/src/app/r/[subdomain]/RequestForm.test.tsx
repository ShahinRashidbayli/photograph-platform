import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import type { Locale } from '@/lib/i18n';
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

  /**
   * The enquiry acknowledgement, and every later Customer message to whoever
   * sent this, is written in the language they read the form in.
   */
  async function submitIn(lang: Locale) {
    const sent: Record<string, unknown>[] = [];
    server.use(
      http.post('/api/public/leads/:subdomain', async ({ request }) => {
        sent.push((await request.json()) as Record<string, unknown>);
        return new HttpResponse(null, { status: 202 });
      })
    );
    const user = setupUser();
    renderWithProviders(<RequestForm subdomain="studio-berg" />, { lang });
    const de = lang === 'de';

    await user.type(screen.getByLabelText(de ? 'Ihr Name *' : 'Your name *'), 'Mia Berg');
    await user.type(screen.getByLabelText(/^E-?Mail/i), 'mia@example.test');
    await user.type(screen.getByLabelText(de ? /Datum/ : /date/i), '2099-06-12');
    await user.selectOptions(
      screen.getByLabelText(de ? 'Art des Shootings *' : /type/i),
      'PORTRAIT'
    );
    await user.selectOptions(screen.getByLabelText(/Budget/), 'OVER_1000');
    await user.click(screen.getByRole('button', { name: de ? /Anfrage senden/ : /Send/ }));

    await waitFor(() => expect(sent).toHaveLength(1));
    return sent[0];
  }

  it('sends German as the language of a German visitor', async () => {
    expect(await submitIn('de')).toMatchObject({ eventType: 'PORTRAIT', language: 'de' });
  });

  it('sends English as the language of an English visitor', async () => {
    expect(await submitIn('en')).toMatchObject({ eventType: 'PORTRAIT', language: 'en' });
  });
});
