import React from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { setupUser } from '@/test-utils/render';
import { CreateBookingModal } from './CreateBookingModal';
import { getBookingsColors, getBookingsStyles } from './bookings.styles';
import api from '@/lib/api';
import { useLangStore } from '@/store/langStore';

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const TEAM = {
  members: [
    { id: 'u-anna', email: 'anna@studio.de', fullName: 'Anna Fischer' },
    { id: 'u-ben', email: 'ben@studio.de', fullName: 'Ben Meyer' },
  ],
};

/**
 * Assignment, and the warning it makes possible.
 *
 * <p>The API side is covered end to end; what these pin is the two decisions
 * the screen makes on its own, both of which are easy to "fix" into something
 * worse:
 *
 * <ul>
 *   <li>The picker only appears once there is somebody to choose between. A
 *       studio of one has nothing to assign — the work is theirs by definition
 *       — and a disabled dropdown listing one name is furniture.
 *   <li>A same-day clash is a <em>warning</em>. Two shoots in one day is
 *       ordinary work, and an overlap is sometimes deliberate; blocking the
 *       save would make the product wrong more often than the double-booking
 *       it prevented.
 * </ul>
 */
beforeEach(() => {
  act(() => useLangStore.setState({ lang: 'en' }));
  mockedApi.get.mockReset();
  mockedApi.get.mockImplementation((url: string) => {
    if (String(url).startsWith('/api/team')) {
      return Promise.resolve({ data: TEAM } as never);
    }
    if (String(url).startsWith('/api/bookings/conflicts')) {
      return Promise.resolve({ data: { conflicts: [], resourceClashes: [] } } as never);
    }
    if (String(url).startsWith('/api/resources')) {
      return Promise.resolve({
        data: [
          { id: 'r-studio', name: 'Studio A', kind: 'ROOM' },
          { id: 'r-light', name: 'Profoto B10', kind: 'EQUIPMENT' },
        ],
      } as never);
    }
    return Promise.resolve({ data: [] } as never);
  });
});
afterEach(() => act(() => useLangStore.setState({ lang: 'de' })));

const render = () =>
  renderWithProviders(
    <CreateBookingModal
      styles={getBookingsStyles('light')}
      colors={getBookingsColors('light')}
      onClose={jest.fn()}
      onCreated={jest.fn()}
    />,
    { lang: 'en' }
  );

it('offers the photographer picker once the studio has more than one', async () => {
  render();
  expect(await screen.findByLabelText('Photographer')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Anna Fischer' })).toBeInTheDocument();
  // The empty option matters: a booking with nobody assigned is a real state,
  // not a gap the form should insist on filling.
  expect(screen.getByRole('option', { name: 'Not assigned yet' })).toBeInTheDocument();
});

it('hides the picker for a studio of one — there is nothing to choose', async () => {
  mockedApi.get.mockImplementation((url: string) =>
    Promise.resolve({
      data: String(url).startsWith('/api/team')
        ? { members: [TEAM.members[0]] }
        : String(url).startsWith('/api/bookings/conflicts')
          ? { conflicts: [], resourceClashes: [] }
          : [],
    } as never)
  );
  render();
  await waitFor(() => expect(mockedApi.get).toHaveBeenCalled());
  expect(screen.queryByLabelText('Photographer')).not.toBeInTheDocument();
});

it('warns about a same-day clash without preventing the save', async () => {
  const user = setupUser();
  mockedApi.get.mockImplementation((url: string) => {
    if (String(url).startsWith('/api/team')) return Promise.resolve({ data: TEAM } as never);
    if (String(url).startsWith('/api/bookings/conflicts')) {
      return Promise.resolve({
        data: {
          conflicts: [
            { id: 'b1', clientName: 'Lena & Kaan', eventTime: '10:00:00', status: 'CONFIRMED' },
          ],
          resourceClashes: [],
        },
      } as never);
    }
    return Promise.resolve({ data: [] } as never);
  });

  render();
  const picker = await screen.findByLabelText('Photographer');
  await user.selectOptions(picker, 'u-anna');
  // The date field is a masked input; typing into it is what the photographer
  // does, and it is what triggers the debounced conflict check.
  await user.type(document.getElementById('bk-eventDate') as HTMLInputElement, '10.10.2026');

  // The clash is named, with the time, so the photographer can judge it.
  expect(await screen.findByText(/already booked that day/i)).toBeInTheDocument();
  expect(await screen.findByText(/Lena & Kaan/)).toBeInTheDocument();

  // And the form is still submittable — this is the whole point.
  expect(screen.getByRole('button', { name: /create|save/i })).toBeEnabled();
});

it('lists the studio\u2019s rooms and kit as checkboxes', async () => {
  render();
  // A shoot uses two or three things; a native multi-select hides that behind
  // a scroll and a modifier key.
  expect(await screen.findByLabelText('Studio A')).toBeInTheDocument();
  expect(screen.getByLabelText('Profoto B10')).toBeInTheDocument();
});

it('warns when a room is taken, naming it, and still allows the save', async () => {
  const user = setupUser();
  mockedApi.get.mockImplementation((url: string) => {
    if (String(url).startsWith('/api/team')) return Promise.resolve({ data: TEAM } as never);
    if (String(url).startsWith('/api/resources')) {
      return Promise.resolve({
        data: [{ id: 'r-studio', name: 'Studio A', kind: 'ROOM' }],
      } as never);
    }
    if (String(url).startsWith('/api/bookings/conflicts')) {
      return Promise.resolve({
        data: {
          conflicts: [],
          resourceClashes: [
            { resourceName: 'Studio A', clientName: 'Meyer', eventTime: '14:00:00' },
          ],
        },
      } as never);
    }
    return Promise.resolve({ data: [] } as never);
  });

  render();
  await user.click(await screen.findByLabelText('Studio A'));
  await user.type(document.getElementById('bk-eventDate') as HTMLInputElement, '05.11.2026');

  // The resource is named, because "the studio is taken" and "the lights are
  // taken" call for different decisions.
  expect(await screen.findByText(/already booked that day/i)).toBeInTheDocument();
  // Targeted at the warning's own markup: the name also appears on the
  // checkbox that selected it, and matching either would pass whether or not
  // the warning names the resource at all.
  expect(await screen.findByText('Studio A', { selector: 'strong' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /create|save/i })).toBeEnabled();
});
