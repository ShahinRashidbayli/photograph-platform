'use client';

import type { ReactNode } from 'react';
import type { ChipTone } from './mock';

/** A status pill inside a product preview, in the app's own status colours. */
export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return <span className={`lp-chip lp-chip-${tone}`}>{children}</span>;
}
