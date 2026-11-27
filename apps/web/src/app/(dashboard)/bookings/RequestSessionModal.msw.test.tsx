import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import type { Locale } from '@/lib/i18n';
import { RequestSessionModal } from './RequestSessionModal';

/**
 * The portal's request form sends the language the Customer reads it in, so
 * the studio's Customer messages about the request (and the booking it
 * becomes) are written in that language.
 */
async function sendRequest(lang: Locale) {
  const sent: Record<string, unknown>[] = [];
  server.use(
    http.post('/api/customer/inquiry-requests', async ({ request }) => {
      sent.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({}, { status: 201 });
    })
  );
  const user = setupUser();
  renderWithProviders(<RequestSessionModal email="anna@example.test" onClose={jest.fn()} />, {
    lang,
  });

  await user.click(screen.getByRole('button', { name: 'Portrait' }));
  await user.click(screen.getByRole('button', { name: '€500–1.000' }));
  const date = screen.getByLabelText(lang === 'de' ? 'Wunschdatum *' : 'Preferred date *');
  await user.type(date, lang === 'de' ? '12.06.2099' : '06/12/2099');
  await user.tab();
  await user.click(
    screen.getByRole('button', { name: lang === 'de' ? /Anfrage senden/ : /Send request/ })
  );

  await waitFor(() => expect(sent).toHaveLength(1));
  return sent[0];
}

describe('RequestSessionModal', () => {
  it('sends English when the portal is in English', async () => {
    const body = await sendRequest('en');
    expect(body).toMatchObject({
      eventType: 'PORTRAIT',
      proposedDate: '2099-06-12',
      language: 'en',
    });
  });

  it('sends German when the portal is in German', async () => {
    const body = await sendRequest('de');
    expect(body).toMatchObject({ language: 'de' });
  });
});
