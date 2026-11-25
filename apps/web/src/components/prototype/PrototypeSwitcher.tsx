'use client';

/**
 * PROTOTYPE ONLY — the floating bar that flips between `?variant=` keys.
 * Lives on the throwaway branch `prototype/landing-light-hero`; never merged.
 */

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect } from 'react';

export interface PrototypeVariant {
  key: string;
  name: string;
}

interface Props {
  variants: PrototypeVariant[];
  current: string;
  /** Extra state to show next to the variant, e.g. the resolved theme. */
  status?: string;
}

export function PrototypeSwitcher({ variants, current, status }: Readonly<Props>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current)
  );

  const go = useCallback(
    (step: number) => {
      const next = variants[(index + step + variants.length) % variants.length];
      const sp = new URLSearchParams(params.toString());
      sp.set('variant', next.key);
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [index, params, pathname, router, variants]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest('input, textarea, [contenteditable]') !== null) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  if (process.env.NODE_ENV === 'production') return null;

  const v = variants[index];
  const btn: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.25)',
    background: 'transparent',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 16,
  };
  return (
    <div
      role="toolbar"
      aria-label="Prototype variants"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 20,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 10px',
        borderRadius: 999,
        background: '#ff3d7f',
        color: '#fff',
        font: '600 13px/1 system-ui, sans-serif',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      }}
    >
      <button type="button" style={btn} onClick={() => go(-1)} aria-label="Previous variant">
        ←
      </button>
      <span style={{ whiteSpace: 'nowrap' }}>
        PROTOTYPE · {v.key} ({v.name}){status ? ` · ${status}` : ''}
      </span>
      <button type="button" style={btn} onClick={() => go(1)} aria-label="Next variant">
        →
      </button>
    </div>
  );
}
