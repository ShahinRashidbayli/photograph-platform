import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import RoadmapPage from './page';

/**
 * The roadmap vote against a faked API that keeps the studio's votes, so what
 * the checkbox ends up showing is what the server ended up holding.
 */
function fakeApi(initial: string[] = []) {
  const stored = new Set(initial);
  const calls: string[] = [];
  server.use(
    http.get('/api/roadmap/interest', () => {
      calls.push('GET');
      return HttpResponse.json([...stored]);
    }),
    http.put('/api/roadmap/interest/:feature', async ({ params }) => {
      calls.push(`PUT ${params.feature}`);
      // Slow enough that the second click lands while this is in flight.
      await new Promise((r) => setTimeout(r, 30));
      stored.add(String(params.feature));
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete('/api/roadmap/interest/:feature', ({ params }) => {
      calls.push(`DELETE ${params.feature}`);
      stored.delete(String(params.feature));
      return new HttpResponse(null, { status: 204 });
    })
  );
  return { stored, calls };
}

describe('Roadmap vote', () => {
  it('a double click registers and then withdraws, in that order', async () => {
    const api = fakeApi();
    const user = setupUser();
    renderWithProviders(<RoadmapPage />, { lang: 'en' });

    const [first] = await screen.findAllByRole('checkbox', { name: 'I would use this' });
    await waitFor(() => expect(first).toBeEnabled());
    // Used to send PUT twice: the second click read the checkbox before React
    // re-rendered it, the API answered 409, and the box stayed ticked.
    await user.dblClick(first!);

    await waitFor(() => expect(api.stored.size).toBe(0));
    await waitFor(() => expect(first).not.toBeChecked());
    // One refetch, after the DELETE. One between them would read the vote the
    // PUT stored and tick the box again until the DELETE's refetch landed.
    await waitFor(() =>
      expect(api.calls.slice(api.calls.indexOf('GET') + 1)).toEqual([
        expect.stringMatching(/^PUT /),
        expect.stringMatching(/^DELETE /),
        'GET',
      ])
    );
  });

  it('a single click registers the vote', async () => {
    const api = fakeApi();
    const user = setupUser();
    renderWithProviders(<RoadmapPage />, { lang: 'en' });

    const [first] = await screen.findAllByRole('checkbox', { name: 'I would use this' });
    await waitFor(() => expect(first).toBeEnabled());
    await user.click(first!);

    expect(await screen.findByRole('checkbox', { name: 'You asked for this' })).toBeChecked();
    await waitFor(() => expect(api.stored.size).toBe(1));
    expect(api.calls.filter((c) => c !== 'GET')).toHaveLength(1);
  });

  it('a failed vote unticks the box again', async () => {
    server.use(
      http.get('/api/roadmap/interest', () => HttpResponse.json([])),
      http.put('/api/roadmap/interest/:feature', () => new HttpResponse(null, { status: 500 }))
    );
    const user = setupUser();
    renderWithProviders(<RoadmapPage />, { lang: 'en' });

    const [first] = await screen.findAllByRole('checkbox', { name: 'I would use this' });
    await waitFor(() => expect(first).toBeEnabled());
    await user.click(first!);

    await waitFor(() =>
      expect(screen.queryByRole('checkbox', { name: 'You asked for this' })).toBeNull()
    );
  });
});
