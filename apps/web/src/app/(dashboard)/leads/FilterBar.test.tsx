import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar';
import { getLeadsColors } from './leads.styles';
import type { LeadPipelineFilter, LeadScoreFilter } from './leadTypes';
import type { LeadSortOrder, SourceFilter } from './useLeadFilters';
import { useLangStore } from '@/store/langStore';

/**
 * The bar is the only place a photographer can see *why* the list below is the
 * size it is, so most of what matters here is whether an applied filter stays
 * visible and removable — and whether any of it reaches a screen reader.
 */

// The product's default locale is German; these assertions read the English
// dictionary so the expected strings are legible next to the source.
beforeEach(() => act(() => useLangStore.setState({ lang: 'en' })));
afterEach(() => act(() => useLangStore.setState({ lang: 'de' })));

const counts: Record<LeadPipelineFilter, number> = { Active: 3, Booked: 1, Rejected: 2, All: 6 };

function setup(overrides: Partial<React.ComponentProps<typeof FilterBar>> = {}) {
  const props = {
    c: getLeadsColors('light'),
    filterPipeline: 'Active' as LeadPipelineFilter,
    setFilterPipeline: jest.fn(),
    filterScore: 'All' as LeadScoreFilter,
    setFilterScore: jest.fn(),
    sourceFilter: 'all' as SourceFilter,
    setSourceFilter: jest.fn(),
    showSourceFilter: true,
    searchTerm: '',
    setSearchTerm: jest.fn(),
    pipelineCounts: counts,
    sortOrder: 'newest' as LeadSortOrder,
    setSortOrder: jest.fn(),
    resultCount: 3,
    ...overrides,
  };
  render(<FilterBar {...props} />);
  return props;
}

describe('pipeline tabs', () => {
  it('marks exactly one tab selected', () => {
    setup();
    const tabs = screen.getAllByRole('tab');

    expect(tabs).toHaveLength(4);
    expect(tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  });

  /** The count is half the answer to "which tab do I want". Rendering it
   *  aria-hidden left a screen-reader user with four bare stage names. */
  it('puts each count in the tab’s accessible name', () => {
    setup();
    const tabs = screen.getAllByRole('tab');

    expect(tabs[0]).toHaveAccessibleName(/Active\s*3/);
    expect(tabs[3]).toHaveAccessibleName(/All\s*6/);
  });

  it('switches the pipeline', async () => {
    const user = userEvent.setup();
    const { setFilterPipeline } = setup();

    await user.click(screen.getByRole('tab', { name: /Booked/ }));
    expect(setFilterPipeline).toHaveBeenCalledWith('Booked');
  });
});

describe('while the inbox is still loading', () => {
  /** Every count is 0 before the data lands, which is a claim rather than a
   *  placeholder — the skeleton below exists to avoid exactly that. */
  it('states no counts at all rather than zeroes', () => {
    setup({ loading: true, resultCount: 0, pipelineCounts: { ...counts } });

    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.textContent).not.toMatch(/\d/);
    }
    expect(screen.queryByText(/enquir/i)).not.toBeInTheDocument();
  });

  it('shows them again once it has', () => {
    setup({ loading: false });

    expect(screen.getByRole('tab', { name: /Active/ })).toHaveTextContent('3');
    expect(screen.getByText(/3 enquiries/i)).toBeInTheDocument();
  });
});

describe('filter popover', () => {
  it('opens, and closes on Escape and on an outside click', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole('button', { name: /open filters/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /** `role="dialog"` promises the panel is where you are now. */
  it('moves focus into the panel and hands it back on Escape', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole('button', { name: /open filters/i });

    await user.click(trigger);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(trigger);
  });

  it('hides the source section when there are no inquiries to tell apart', async () => {
    const user = userEvent.setup();
    setup({ showSourceFilter: false });

    await user.click(screen.getByRole('button', { name: /open filters/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Score')).toBeInTheDocument();
    expect(within(dialog).queryByText('Source')).not.toBeInTheDocument();
  });

  it('leaves an already-applied source filter clearable after that section hides', async () => {
    const user = userEvent.setup();
    const props = setup({ showSourceFilter: false, sourceFilter: 'customer' });

    await user.click(screen.getByRole('button', { name: /open filters/i }));
    await user.click(screen.getByRole('button', { name: /clear all/i }));
    expect(props.setSourceFilter).toHaveBeenCalledWith('all');
    expect(props.setFilterScore).toHaveBeenCalledWith('All');
  });
});

describe('badge and chips', () => {
  it('counts only the axes hidden behind the button', () => {
    setup({ filterScore: 'High', sourceFilter: 'form', searchTerm: 'anna' });

    expect(screen.getByRole('button', { name: /open filters/i })).toHaveTextContent('2');
  });

  it('leaves the search term out of the badge — it is already on screen', () => {
    setup({ searchTerm: 'anna' });

    expect(screen.getByRole('button', { name: /open filters/i }).textContent).not.toMatch(/\d/);
  });

  it('renders one removable chip per applied filter', async () => {
    const user = userEvent.setup();
    const props = setup({ filterScore: 'High', sourceFilter: 'form', searchTerm: '  anna  ' });
    const removes = screen.getAllByRole('button', { name: /remove filter/i });

    expect(removes).toHaveLength(3);
    expect(screen.getByText(/Search: “anna”/)).toBeInTheDocument();

    await user.click(removes[0]);
    expect(props.setFilterScore).toHaveBeenCalledWith('All');
    await user.click(removes[2]);
    expect(props.setSearchTerm).toHaveBeenCalledWith('');
  });

  it('shows no chip for a search that is only whitespace, since it filters nothing', () => {
    setup({ searchTerm: '   ' });

    expect(screen.queryByRole('button', { name: /remove filter/i })).not.toBeInTheDocument();
  });
});

describe('search box', () => {
  it('offers a clear button only once there is something to clear', async () => {
    const user = userEvent.setup();
    const { setSearchTerm } = setup({ searchTerm: 'anna' });

    await user.click(screen.getByRole('button', { name: /clear search/i }));
    expect(setSearchTerm).toHaveBeenCalledWith('');
  });

  it('has none when empty', () => {
    setup();

    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
  });
});

describe('sort control', () => {
  it('describes the order it is in and toggles to the other', async () => {
    const user = userEvent.setup();
    const { setSortOrder } = setup();

    await user.click(screen.getByRole('button', { name: /sorted newest first/i }));
    expect(setSortOrder).toHaveBeenCalledWith('oldest');
  });

  it.each([
    [1, /1 enquiry/i],
    [0, /0 enquir/i],
  ])('states a result count of %s', (resultCount, expected) => {
    setup({ resultCount });

    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
