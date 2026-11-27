import React from 'react';
import { act, screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import { useAuthStore } from '@/store/authStore';
import { useLangStore } from '@/store/langStore';
import { leadsKey } from '@/hooks/useLeads';
import { BrandingSettings } from './BrandingSettings';
import { EnquiryAcknowledgementSettings } from './EnquiryAcknowledgementSettings';
import { LegalDetailsSection } from './LegalDetailsSection';
import { PersonalDataErasure } from './PersonalDataErasure';

/**
 * Branding, the Impressum details and erasure against a faked API.
 *
 * <p>Two of these failed before the move to hooks. The legal form reloaded
 * when the language changed and threw away what the photographer had typed;
 * and an erasure left every cached list still showing the person just erased.
 */
const LEGAL = {
  subdomain: 'anna-foto',
  legalName: 'Anna Fischer Fotografie',
  legalStreet: 'Hauptstr. 1',
  legalPostalCode: '10115',
  legalCity: 'Berlin',
  legalCountry: 'Deutschland',
  legalEmail: 'anna@example.de',
  legalPhone: '030 123456',
  legalVatId: null,
  legalRegister: null,
  legalResponsible: null,
  privacyContactEmail: null,
  complete: true,
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

describe('LegalDetailsSection', () => {
  it('keeps what was typed when the language changes', async () => {
    let reads = 0;
    server.use(
      http.get('/api/tenant/legal', () => {
        reads += 1;
        return HttpResponse.json(LEGAL);
      })
    );
    const user = setupUser();
    renderWithProviders(<LegalDetailsSection theme="light" />, { lang: 'en' });

    const name = await screen.findByLabelText(/Provider \/ name/);
    await waitFor(() => expect(name).toHaveValue('Anna Fischer Fotografie'));
    await user.clear(name);
    await user.type(name, 'Anna F. Studio');

    act(() => useLangStore.setState({ lang: 'de' }));
    await screen.findByLabelText(/Anbieter \/ Name/);
    // Long enough for a reload triggered by the switch to land and repaint —
    // the old form re-read the server on every language change.
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));

    expect(screen.getByLabelText(/Anbieter \/ Name/)).toHaveValue('Anna F. Studio');
    expect(reads).toBe(1);
  });

  it('shows the saved values after a save', async () => {
    server.use(
      http.get('/api/tenant/legal', () => HttpResponse.json(LEGAL)),
      http.put('/api/tenant/legal', async ({ request }) =>
        HttpResponse.json({ ...LEGAL, ...((await request.json()) as object) })
      )
    );
    const user = setupUser();
    renderWithProviders(<LegalDetailsSection theme="light" />, { lang: 'en' });

    const name = await screen.findByLabelText(/Provider \/ name/);
    await waitFor(() => expect(name).toHaveValue('Anna Fischer Fotografie'));
    await user.clear(name);
    await user.type(name, 'Anna F. Studio');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
    expect(name).toHaveValue('Anna F. Studio');
  });
});

describe('BrandingSettings', () => {
  function fakeStudio() {
    server.use(
      http.get('/api/entitlements', () =>
        HttpResponse.json({
          plan: 'STUDIO',
          capabilities: ['WHITE_LABEL_BRANDING'],
          galleryRetentionDays: 730,
          seats: 3,
          commissionBps: 0,
          writable: true,
        })
      ),
      http.get('/api/settings/branding', () =>
        HttpResponse.json({ logoUrl: null, brandColor: '#112233', whiteLabel: true })
      )
    );
  }

  it('saves only the colour', async () => {
    fakeStudio();
    let body: unknown = null;
    server.use(
      http.put('/api/settings/branding', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ logoUrl: null, brandColor: '#445566', whiteLabel: true });
      })
    );
    const user = setupUser();
    renderWithProviders(<BrandingSettings />, { lang: 'en' });

    const hex = (await screen.findAllByLabelText('Brand colour')).find(
      (el) => (el as HTMLInputElement).type !== 'color'
    )!;
    await waitFor(() => expect(hex).toHaveValue('#112233'));
    await user.clear(hex);
    await user.type(hex, '#445566');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Branding saved.')).toBeInTheDocument();
    // The logo is a different control; a colour save must not touch it.
    expect(body).toEqual({ brandColor: '#445566' });
  });

  it('says so when saving fails', async () => {
    fakeStudio();
    server.use(http.put('/api/settings/branding', () => HttpResponse.json({}, { status: 500 })));
    const user = setupUser();
    renderWithProviders(<BrandingSettings />, { lang: 'en' });

    await screen.findAllByLabelText('Brand colour');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Could not save your branding.')).toBeInTheDocument();
  });
});

describe('PersonalDataErasure', () => {
  it('drops every cached list once a person is erased', async () => {
    const items = [
      { category: 'clients', deleted: 1, anonymized: 0, retained: 0, retentionBasis: null },
    ];
    server.use(
      http.post('/api/privacy/erasure/preview', () =>
        HttpResponse.json({ executed: false, items })
      ),
      http.post('/api/privacy/erasure', () => HttpResponse.json({ executed: true, items }))
    );
    const user = setupUser();
    const { queryClient } = renderWithProviders(<PersonalDataErasure />, { lang: 'en' });
    // The leads inbox visited a moment ago, with the person still in it. Kept past the
    // test client's gcTime of 0, as a real visit's cache would be.
    queryClient.setQueryDefaults(leadsKey(), { gcTime: Infinity });
    queryClient.setQueryData(leadsKey(), [{ id: 'l1', email: 'maria@example.test' }]);

    await user.type(screen.getByLabelText("The person's email address"), 'maria@example.test');
    await user.click(screen.getByRole('button', { name: 'Show what would be erased' }));
    await user.click(await screen.findByRole('button', { name: 'Erase permanently' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Erase permanently' })
    );

    expect(await screen.findByText('Erased maria@example.test')).toBeInTheDocument();
    expect(queryClient.getQueryState(leadsKey())?.isInvalidated).toBe(true);
  });
});

describe('EnquiryAcknowledgementSettings', () => {
  it('switches the acknowledgement off and shows it off', async () => {
    const puts: unknown[] = [];
    server.use(
      http.get('/api/settings/enquiry-acknowledgement', () => HttpResponse.json({ enabled: true })),
      http.put('/api/settings/enquiry-acknowledgement', async ({ request }) => {
        const body = (await request.json()) as { enabled: boolean };
        puts.push(body);
        return HttpResponse.json(body);
      })
    );
    const user = setupUser();
    renderWithProviders(<EnquiryAcknowledgementSettings />, { lang: 'en' });

    const toggle = await screen.findByRole('switch', {
      name: 'Acknowledge enquiries automatically',
    });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await user.click(toggle);

    await waitFor(() => expect(puts).toEqual([{ enabled: false }]));
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    expect(await screen.findByText(/Off — enquirers hear only from you/)).toBeInTheDocument();
  });

  it('says so when the switch cannot be saved, and stays where it was', async () => {
    server.use(
      http.get('/api/settings/enquiry-acknowledgement', () => HttpResponse.json({ enabled: true })),
      http.put('/api/settings/enquiry-acknowledgement', () =>
        HttpResponse.json({}, { status: 500 })
      )
    );
    const user = setupUser();
    renderWithProviders(<EnquiryAcknowledgementSettings />, { lang: 'de' });

    const toggle = await screen.findByRole('switch', { name: 'Anfragen automatisch bestätigen' });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);

    expect(
      await screen.findByText('Diese Einstellung konnte nicht gespeichert werden.')
    ).toBeInTheDocument();
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
  });

  it('says so when the setting cannot be loaded, and draws no switch it cannot vouch for', async () => {
    server.use(
      http.get('/api/settings/enquiry-acknowledgement', () =>
        HttpResponse.json({}, { status: 500 })
      )
    );
    renderWithProviders(<EnquiryAcknowledgementSettings />, { lang: 'en' });

    expect(await screen.findByText('Could not load this setting.')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('shows the switch off when the studio has turned it off', async () => {
    server.use(
      http.get('/api/settings/enquiry-acknowledgement', () => HttpResponse.json({ enabled: false }))
    );
    renderWithProviders(<EnquiryAcknowledgementSettings />, { lang: 'en' });

    const toggle = await screen.findByRole('switch', {
      name: 'Acknowledge enquiries automatically',
    });
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
  });
});
