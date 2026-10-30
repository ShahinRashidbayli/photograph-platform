/**
 * Shared avatar helpers — one source of truth so a given person gets the
 * same initials and the same colour everywhere (Dashboard, Clients, Leads).
 */

export type AvatarColor = { bg: string; fg: string };

const AVATAR_PALETTE_LIGHT: AvatarColor[] = [
  { bg: '#DBEAFE', fg: '#1D4ED8' },
  { bg: '#FCE7F3', fg: '#BE185D' },
  { bg: '#DCFCE7', fg: '#15803D' },
  { bg: '#FEF3C7', fg: '#B45309' },
  { bg: '#EDE9FE', fg: '#6D28D9' },
  { bg: '#FFE4E6', fg: '#BE123C' },
  { bg: '#E0F2FE', fg: '#0369A1' },
];

const AVATAR_PALETTE_DARK: AvatarColor[] = [
  { bg: 'rgba(59, 130, 246, 0.22)', fg: '#93C5FD' },
  { bg: 'rgba(236, 72, 153, 0.22)', fg: '#F9A8D4' },
  { bg: 'rgba(16, 185, 129, 0.22)', fg: '#6EE7B7' },
  { bg: 'rgba(217, 119, 6, 0.22)', fg: '#FCD34D' },
  { bg: 'rgba(139, 92, 246, 0.22)', fg: '#C4B5FD' },
  { bg: 'rgba(244, 63, 94, 0.22)', fg: '#FCA5A5' },
  { bg: 'rgba(14, 165, 233, 0.22)', fg: '#7DD3FC' },
];

/** Two-letter initials: first+last name, or the first two letters of one word. */
export function getInitials(name: string): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic colour for a seed (an id or name) so it's stable per person. */
export function pickAvatarColor(seed: string, isDark: boolean): AvatarColor {
  const palette = isDark ? AVATAR_PALETTE_DARK : AVATAR_PALETTE_LIGHT;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}
