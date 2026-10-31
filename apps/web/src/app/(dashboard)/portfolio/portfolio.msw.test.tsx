import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders, setupUser } from '@/test-utils/render';
import { http, HttpResponse, server } from '@/test-utils/msw';
import type { PortfolioCategory, PortfolioPhoto } from '@/hooks/usePortfolio';
import PortfolioAdminPage from './page';

/**
 * The portfolio manager against a faked API.
 *
 * <p>Three of these failed before the move to React Query: a failed category
 * change showed nothing, a failed delete showed axios' own English sentence,
 * and photos filed under a deleted category could not be reached.
 */
const CATEGORY: PortfolioCategory = {
  id: 'c1',
  name: 'Weddings',
  sortOrder: 0,
  createdAt: '2026-09-01T00:00:00Z',
};

function photo(id: string, change: Partial<PortfolioPhoto> = {}): PortfolioPhoto {
  return {
    id,
    categoryId: null,
    viewUrl: `/${id}.jpg`,
    thumbnailUrl: null,
    fileSizeBytes: 1,
    width: 1,
    height: 1,
    sortOrder: 0,
    published: false,
    createdAt: '2026-09-01T00:00:00Z',
    ...change,
  };
}

function fakeApi(photos: PortfolioPhoto[], categories: PortfolioCategory[] = [CATEGORY]) {
  server.use(
    http.get('/api/portfolio/photos', () => HttpResponse.json(photos)),
    http.get('/api/portfolio/categories', () => HttpResponse.json(categories))
  );
}

describe('PortfolioAdminPage', () => {
  afterEach(() => jest.restoreAllMocks());

  it('says so when moving a photo to a category fails', async () => {
    fakeApi([photo('p1')]);
    server.use(
      http.patch('/api/portfolio/photos/p1/category', () => HttpResponse.json({}, { status: 500 }))
    );
    const user = setupUser();
    renderWithProviders(<PortfolioAdminPage />, { lang: 'en' });

    await user.selectOptions(await screen.findByLabelText('Photo category'), 'c1');

    expect(
      await screen.findByText('Could not move the photo to that category.')
    ).toBeInTheDocument();
  });

  it('shows its own message when a delete fails, not the HTTP client’s', async () => {
    fakeApi([photo('p1')]);
    server.use(
      http.delete('/api/portfolio/photos/p1', () => HttpResponse.json({}, { status: 500 }))
    );
    const user = setupUser();
    renderWithProviders(<PortfolioAdminPage />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Delete photo' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete photo' })
    );

    expect(await screen.findByText('Delete failed')).toBeInTheDocument();
    expect(screen.queryByText(/status code/)).not.toBeInTheDocument();
  });

  it('offers "Uncategorised" for photos filed under a category that no longer exists', async () => {
    fakeApi([photo('p1', { categoryId: 'deleted-long-ago' })]);
    const user = setupUser();
    renderWithProviders(<PortfolioAdminPage />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: /Uncategorised/ }));

    expect(screen.getByLabelText('Photo category')).toBeInTheDocument();
  });

  it('moves the photos of a deleted category to "Uncategorised"', async () => {
    fakeApi([photo('p1', { categoryId: 'c1' })]);
    server.use(
      http.delete('/api/portfolio/categories/c1', () => new HttpResponse(null, { status: 204 }))
    );
    const user = setupUser();
    renderWithProviders(<PortfolioAdminPage />, { lang: 'en' });

    jest.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(await screen.findByRole('button', { name: 'Delete Weddings' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Weddings/ })).not.toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /Uncategorised/ })).toBeInTheDocument();
  });

  it('flips a photo to published when the API confirms it', async () => {
    fakeApi([photo('p1')]);
    server.use(
      http.post('/api/portfolio/photos/p1/publish', () =>
        HttpResponse.json(photo('p1', { published: true }))
      )
    );
    const user = setupUser();
    renderWithProviders(<PortfolioAdminPage />, { lang: 'en' });

    await user.click(await screen.findByRole('button', { name: 'Publish' }));

    expect(await screen.findByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
  });
});
