import type { ColorTokens } from './leadTypes';

/**
 * Score breakdown bars — one horizontal bar per component (budget, type,
 * lead time), each scored 0–100. The bar fill color encodes strength
 * (green ≥ 80, amber ≥ 50, danger below) so the eye can tell a "high
 * priority" rolled-up score from one component dragging down the others.
 *
 * <p>Defensive: backend fields are optional in the TS type — if they're
 * missing (older response, server hiccup) the component renders nothing
 * rather than 0% bars that would misrepresent reality.
 */
export function ScoreBreakdown({
  c,
  budgetScore,
  typeScore,
  timeScore,
}: Readonly<{
  c: ColorTokens;
  budgetScore?: number;
  typeScore?: number;
  timeScore?: number;
}>) {
  if (budgetScore == null && typeScore == null && timeScore == null) return null;

  const rows: Array<{ label: string; value: number }> = [];
  if (budgetScore != null) rows.push({ label: 'Budget', value: budgetScore });
  if (typeScore != null) rows.push({ label: 'Event type', value: typeScore });
  if (timeScore != null) rows.push({ label: 'Lead time', value: timeScore });

  // Uniform primary fill — the numeric score on the right already encodes
  // strength, so tier-coloring the bars themselves (green/amber/red) is
  // double-encoding and competes with the actual semantic colour use
  // elsewhere on the page (priority badge, status badges). Very low scores
  // (<30) render in a muted tone so an obviously-weak signal still recedes
  // visually without screaming "DANGER" in red, which it isn't — it's just
  // a soft lead.
  const fillColor = (v: number) => (v < 30 ? c.textMuted : c.primary);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
      {rows.map((r) => (
        <div
          key={r.label}
          style={{
            display: 'grid',
            gridTemplateColumns: '92px 1fr 32px',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: c.textMuted, fontWeight: 600 }}>
            {r.label}
          </span>
          <div
            role="progressbar"
            aria-valuenow={r.value}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${r.label} score`}
            style={{
              height: '6px',
              borderRadius: '999px',
              background: c.divider,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, r.value))}%`,
                background: fillColor(r.value),
                borderRadius: '999px',
                transition: 'width 250ms ease',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: c.text,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}
