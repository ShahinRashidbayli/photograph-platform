import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import api from '@/lib/api';
import { asyncError } from '@/lib/async-error';

export interface MonthlyAmount {
  month: number;
  invoicedCents: number;
  collectedCents: number;
}

/** Mirrors `AnalyticsResponse` on the API. */
export interface Analytics {
  year: number;
  availableYears: number[];
  revenue: {
    invoicedCents: number;
    collectedCents: number;
    outstandingCents: number;
    invoiceCount: number;
    averageInvoiceCents: number;
    months: MonthlyAmount[];
  };
  bookings: {
    total: number;
    byStatus: { status: string; count: number }[];
    months: { month: number; count: number }[];
    topPackages: { name: string; count: number; revenueCents: number }[];
    leadsReceived: number;
    leadsConverted: number;
    /** Who shot what. `name` is null for the unassigned bucket. */
    byPhotographer: { name: string | null; count: number; revenueCents: number }[];
  };
}

/** Mirrors `YearSummaryResponse` on the API. */
export interface YearSummary {
  /** The current calendar year in Europe/Berlin. */
  year: number;
  /** The quoted value of this year's Billable bookings. */
  bookedCents: number;
  /** The year so far, net of Storno — the report's year total. */
  invoicedCents: number;
  /** The payments that arrived this year — the report's year total. */
  collectedCents: number;
}

/** `null` is "the server's choice" — the current year, or the latest with data. */
export function analyticsKey(year: number | null) {
  return ['analytics', year] as const;
}

export function yearSummaryKey() {
  return ['yearSummary'] as const;
}

/**
 * Booked, Invoiced and Collected for the current year: the dashboard tiles and
 * the bookings overview. On every plan; unlike `useAnalytics`, the endpoint
 * has no plan gate.
 *
 * <p>Booking, invoice and payment mutations invalidate it. `staleTime: 0` is
 * for the payment none of them sees: a Customer paying by card lands through
 * the Stripe webhook, on nobody's screen.
 */
export function useYearSummary() {
  return useQuery({
    queryKey: yearSummaryKey(),
    staleTime: 0,
    queryFn: async () => (await api.get<YearSummary>('/api/analytics/summary')).data,
  });
}

/**
 * One year of the studio's figures, shared by the revenue and booking screens.
 *
 * <p>Both read the same endpoint. Revenue and bookings are the same events
 * counted two ways, so two endpoints would mean two round trips that can
 * disagree whenever one is a month stale — and the payload is small enough
 * that fetching the half you are not showing costs nothing.
 *
 * <p>`staleTime: 0`: every invoice, payment and booking write changes these
 * numbers, and none of those mutations invalidates them. Cached figures show
 * at once and are re-read behind them, as fresh as the old fetch-on-visit.
 *
 * @returns `locked` when the plan does not include reports. That is a 402 from
 *   the API, not a failure: the screen answers it with an upgrade prompt rather
 *   than an error, because the customer has done nothing wrong.
 */
export function useAnalytics() {
  const [requestedYear, selectYear] = useState<number | null>(null);
  const query = useQuery({
    queryKey: analyticsKey(requestedYear),
    staleTime: 0,
    // A 402 will be a 402 again.
    retry: (count, err) => !(axios.isAxiosError(err) && err.response?.status === 402) && count < 1,
    // The previous year stays on screen while the next one loads.
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await api.get<Analytics>('/api/analytics', {
          params: requestedYear ? { year: requestedYear } : undefined,
        })
      ).data,
  });
  const locked = axios.isAxiosError(query.error) && query.error.response?.status === 402;
  return {
    data: query.data ?? null,
    year: query.data?.year ?? null,
    // The first read, or a newly chosen year — not the background re-read.
    loading: query.isLoading || query.isPlaceholderData,
    locked,
    error: query.isError && !locked ? asyncError(query.error, 'analytics.loadError') : null,
    selectYear,
  };
}
