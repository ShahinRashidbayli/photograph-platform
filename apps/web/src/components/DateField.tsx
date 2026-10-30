'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fontSize, getColors, radius, space } from '@/lib/design-tokens';
import { INTL_LOCALE, useTranslation, type Locale } from '@/lib/i18n';
import { useThemeStore } from '@/store/themeStore';
import { todayIso } from '@/lib/helpers';

/**
 * A date input that speaks the *app's* language.
 *
 * `<input type="date">` cannot do this. Its visible format and placeholder come
 * from the browser's own language setting, not from the page — so a Chrome set
 * to Turkish renders "gg.aa.yyyy" inside an English interface, and no amount of
 * `lang` on the document or the element changes it. That is the entire reason
 * this component exists: the field is a plain text input we format ourselves,
 * with a calendar popover we draw ourselves.
 *
 * The value crossing the boundary is always ISO `YYYY-MM-DD` — the same shape
 * the API speaks — so callers never deal with display formats.
 */

type DatePattern = {
  /** Field order as rendered and parsed. */
  order: ReadonlyArray<'d' | 'm' | 'y'>;
  separator: string;
  /** Format mask shown when the field is empty. */
  placeholder: string;
};

/**
 * Order, separator and mask belong together: they are one format description,
 * and splitting the mask into the message catalogue would let the words drift
 * out of step with the parser (a mask reading "TT.MM.JJJJ" while the parser
 * expects month-first is worse than no mask at all).
 */
export const DATE_PATTERNS: Record<Locale, DatePattern> = {
  en: { order: ['m', 'd', 'y'], separator: '/', placeholder: 'MM/DD/YYYY' },
  de: { order: ['d', 'm', 'y'], separator: '.', placeholder: 'TT.MM.JJJJ' },
};

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO `YYYY-MM-DD` → the locale's display string. */
export function isoToDisplay(iso: string, pattern: DatePattern): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return '';
  const parts = { y: match[1], m: match[2], d: match[3] };
  return pattern.order.map((key) => parts[key]).join(pattern.separator);
}

/**
 * Display string → ISO, or null when it isn't a complete valid date.
 *
 * Accepts any of `. / -` as the separator regardless of locale (people paste
 * and type both), and accepts a full ISO string as-is, so a pasted API value
 * is never rejected.
 */
export function displayToIso(input: string, pattern: DatePattern): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (iso) return buildIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const chunks = trimmed.split(/[./-]/).filter(Boolean);
  if (chunks.length !== 3 || chunks.some((c) => !/^\d+$/.test(c))) return null;

  const values: Record<'d' | 'm' | 'y', number> = { d: 0, m: 0, y: 0 };
  pattern.order.forEach((key, index) => {
    values[key] = Number(chunks[index]);
  });
  return buildIso(values.y, values.m, values.d);
}

/** Rejects impossible dates (31 February) rather than letting Date roll over. */
function buildIso(year: number, month: number, day: number): string | null {
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function DateField({
  id,
  value,
  onChange,
  min,
  invalid,
  ariaLabel,
  style,
}: Readonly<{
  id?: string;
  /** ISO `YYYY-MM-DD`, or '' when empty. */
  value: string;
  onChange: (_iso: string) => void;
  /** Earliest selectable date, ISO. Days before it are disabled in the grid. */
  min?: string;
  invalid?: boolean;
  ariaLabel?: string;
  /** The host form's input styling, so the field looks native to each screen. */
  style?: React.CSSProperties;
}>) {
  // Theme and language are read here rather than threaded through every caller:
  // both are global, and the callers (three different modals) carry three
  // different colour-token shapes between them.
  const { t, lang } = useTranslation();
  const { theme } = useThemeStore();
  const c = getColors(theme);
  const pattern = DATE_PATTERNS[lang];

  const [text, setText] = useState(() => isoToDisplay(value, pattern));
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Follow the value when it changes from outside (form reset, edit mode) or
  // when the language switches under a filled field.
  useEffect(() => {
    setText(isoToDisplay(value, pattern));
  }, [value, pattern]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function commit(next: string) {
    setText(next);
    const iso = displayToIso(next, pattern);
    // Empty clears the value; a half-typed date simply doesn't commit yet, so
    // the field never reports garbage upstream.
    if (!next.trim()) onChange('');
    else if (iso) onChange(iso);
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        placeholder={pattern.placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => {
          // Normalise on the way out: "1.2.2026" becomes "01.02.2026".
          const iso = displayToIso(text, pattern);
          if (iso) setText(isoToDisplay(iso, pattern));
        }}
        style={{ ...style, paddingInlineEnd: 38 }}
      />
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t('dateField.open')}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          position: 'absolute',
          insetInlineEnd: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 28,
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          background: 'transparent',
          color: c.textMuted,
          cursor: 'pointer',
          borderRadius: radius.control,
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && (
        <MonthGrid
          selected={value}
          min={min}
          locale={lang}
          colors={c}
          onPick={(iso) => {
            onChange(iso);
            setText(isoToDisplay(iso, pattern));
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** Monday-first month grid, matching the bookings calendar's week start. */
function MonthGrid({
  selected,
  min,
  locale,
  colors,
  onPick,
}: Readonly<{
  selected: string;
  min?: string;
  locale: Locale;
  colors: ReturnType<typeof getColors>;
  onPick: (_iso: string) => void;
}>) {
  const today = todayIso();
  const [cursor, setCursor] = useState(() => {
    const base = /^\d{4}-\d{2}-\d{2}$/.test(selected) ? selected : today;
    return { year: Number(base.slice(0, 4)), month: Number(base.slice(5, 7)) - 1 };
  });

  const tag = INTL_LOCALE[locale];

  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(tag, { weekday: 'short' });
    // 2024-01-01 is a Monday, which is where the grid starts.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  }, [tag]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric' }).format(
        new Date(cursor.year, cursor.month, 1)
      ),
    [tag, cursor]
  );

  const days = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    // JS weeks start Sunday; shift so Monday is column 0.
    const lead = (first.getDay() + 6) % 7;
    const count = new Date(cursor.year, cursor.month + 1, 0).getDate();
    return [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: count }, (_, i) => i + 1),
    ];
  }, [cursor]);

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  const navButton: React.CSSProperties = {
    width: 26,
    height: 26,
    borderRadius: radius.control,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    color: colors.text,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
  };

  return (
    <div
      role="dialog"
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        insetInlineStart: 0,
        zIndex: 90,
        width: 260,
        padding: space.md,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.card,
        boxShadow: colors.elevatedShadow,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space.sm,
          marginBottom: space.sm,
        }}
      >
        <button type="button" onClick={() => shiftMonth(-1)} style={navButton} aria-label="←">
          ‹
        </button>
        <span style={{ fontSize: fontSize.base, fontWeight: 700, color: colors.text }}>
          {monthLabel}
        </span>
        <button type="button" onClick={() => shiftMonth(1)} style={navButton} aria-label="→">
          ›
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {weekdays.map((day) => (
          <span
            key={day}
            style={{
              fontSize: fontSize.xs,
              fontWeight: 700,
              color: colors.textMuted,
              textAlign: 'center',
              padding: `${space.xs} 0`,
            }}
          >
            {day.slice(0, 2)}
          </span>
        ))}
        {days.map((day, index) => {
          if (day === null) return <span key={`pad-${index}`} />;
          const iso = `${cursor.year}-${pad(cursor.month + 1)}-${pad(day)}`;
          const disabled = min ? iso < min : false;
          const isSelected = iso === selected;
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onPick(iso)}
              style={{
                height: 30,
                borderRadius: radius.control,
                border:
                  isToday && !isSelected
                    ? `1px solid ${colors.primaryBorder}`
                    : '1px solid transparent',
                background: isSelected ? colors.primarySolid : 'transparent',
                color: isSelected ? '#FFFFFF' : disabled ? colors.textMuted : colors.text,
                opacity: disabled ? 0.35 : 1,
                fontSize: fontSize.base,
                fontWeight: isSelected || isToday ? 700 : 500,
                fontFamily: 'inherit',
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!disabled && !isSelected)
                  e.currentTarget.style.background = colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'transparent';
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
