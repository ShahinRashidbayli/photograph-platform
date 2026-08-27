'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import api from '@/lib/api';
import { asyncError, type AsyncError } from '@/lib/async-error';

export interface MonthlyAmount {
  month: number;
  invoicedCents: number;
  collectedCents: number;
}

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

/**
 * One year of the studio's figures, shared by the revenue and booking screens.
 *
 * <p>Both read the same endpoint. Revenue and bookings are the same events
 * counted two ways, so two endpoints would mean two round trips that can
 * disagree whenever one is a month stale — and the payload is small enough
 * that fetching the half you are not showing costs nothing.
 *
 * @returns `locked` when the plan does not include reports. That is a 402 from
 *   the API, not a failure: the screen answers it with an upgrade prompt rather
 *   than an error, because the customer has done nothing wrong.
 */
export function useAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<AsyncError | null>(null);

  const load = useCallback(async (requested: number | null) => {
    setLoading(true);
    setError(null);
    try {
      const { data: result } = await api.get<Analytics>('/api/analytics', {
        params: requested ? { year: requested } : undefined,
      });
      setData(result);
      setYear(result.year);
      setLocked(false);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 402) {
        setLocked(true);
      } else {
        setError(asyncError(err, 'analytics.loadError'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  return { data, year, loading, locked, error, selectYear: (y: number) => void load(y) };
}

/** Month initials for the axis, in the active locale. */
export function monthLabels(lang: string): string[] {
  const fmt = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { month: 'short' });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2024, i, 1)));
}
