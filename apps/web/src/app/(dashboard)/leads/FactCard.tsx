import type { ColorTokens } from './leadTypes';

/**
 * Compact bordered tile for a single lead fact (email, budget, etc.).
 *
 * <p>The grid of these replaces the previous vertical label-row layout. Each
 * tile is a discrete visual unit, which makes facts scannable at a glance
 * and lets individual values carry their own treatment (a budget can read
 * green; an email can read in primary color) without breaking the rhythm of
 * a shared container.
 *
 * <p>Either {@code value} or {@code chip} is rendered — chip wins when both
 * are supplied. {@code emphasised} bumps the font weight for facts the
 * photographer should notice first (typically a high budget).
 */
export function FactCard({
  c,
  label,
  value,
  valueColor,
  emphasised,
  chip,
}: Readonly<{
  c: ColorTokens;
  label: string;
  value?: string;
  valueColor?: string;
  emphasised?: boolean;
  chip?: { bg: string; color: string; dot: string; label: string };
}>) {
  return (
    <div
      style={{
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderRadius: '10px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          color: c.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>
      {chip ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 8px',
            borderRadius: '999px',
            background: chip.bg,
            color: chip.color,
            fontSize: '0.78rem',
            fontWeight: 600,
            width: 'fit-content',
          }}
        >
          <span
            aria-hidden
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: chip.dot,
            }}
          />
          {chip.label}
        </span>
      ) : (
        <span
          title={value}
          style={{
            fontSize: '0.88rem',
            fontWeight: emphasised ? 700 : 600,
            color: valueColor ?? c.text,
            lineHeight: 1.4,
            // Long emails wrap mid-domain on narrow tiles; anywhere lets the
            // break happen at sensible visual points rather than a forced
            // mid-character cut.
            overflowWrap: 'anywhere',
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
}
