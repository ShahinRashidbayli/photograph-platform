import type { CSSProperties } from 'react';

/**
 * Icon — a small, dependency-free set of stroke icons drawn on a single 24×24
 * grid with one stroke weight, so the marketing/product surfaces read as one
 * professional system instead of OS emoji that render differently per platform.
 *
 * All glyphs inherit `currentColor`, so colour is set by the parent's `color`.
 * Style follows the Lucide convention: 24px box, round caps/joins, ~1.75 weight.
 */
export type IconName =
  | 'target'
  | 'calendar'
  | 'contract'
  | 'card'
  | 'gallery'
  | 'globe'
  | 'camera'
  | 'heart'
  | 'check'
  | 'check-circle'
  | 'briefcase'
  | 'user'
  | 'mail'
  | 'arrow-right';

const PATHS: Record<IconName, React.ReactNode> = {
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18" />
      <path d="M8 3v3" />
      <path d="M16 3v3" />
      <path d="M9 14.5l2 2 4-4" />
    </>
  ),
  contract: (
    <>
      <path d="M15 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M15 3v5h5" />
      <path d="M8.5 12.5h4" />
      <path d="M8 16.4c.8-1.2 1.6-1.2 2.2 0s1.4 1.2 2.2 0" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19" />
      <path d="M6 14.5h4" />
    </>
  ),
  gallery: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <circle cx="8.5" cy="8.5" r="1.8" />
      <path d="M21 15l-4.5-4.5L5 21" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.4 3.9 5.6 3.9 9s-1.4 6.6-3.9 9c-2.5-2.4-3.9-5.6-3.9-9S9.5 5.4 12 3z" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.5-2.2a1 1 0 0 1 .83-.44h5.34a1 1 0 0 1 .83.44L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
  heart: (
    <path d="M12 20s-7-4.3-9.2-8.4C1.3 8.9 2.6 5.5 6 5.5c2 0 3.2 1.3 4 2.5.8-1.2 2-2.5 4-2.5 3.4 0 4.7 3.4 3.2 6.1C19 15.7 12 20 12 20z" />
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12l2.5 2.5L15.5 9.5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2.2" />
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
      <path d="M3 12.5h18" />
      <path d="M10.5 12.5h3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7.5l7.3 5.2a2 2 0 0 0 2.4 0l7.3-5.2" />
    </>
  ),
  'arrow-right': (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
};

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  style?: CSSProperties;
  'aria-hidden'?: boolean;
}

export function Icon({ name, size = 22, strokeWidth = 1.75, style, ...rest }: Readonly<IconProps>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={rest['aria-hidden'] ?? true}
      focusable="false"
      shapeRendering="geometricPrecision"
      style={{ display: 'block', ...style }}
    >
      {PATHS[name]}
    </svg>
  );
}
