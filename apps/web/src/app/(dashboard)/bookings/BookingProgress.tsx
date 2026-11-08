'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';
import type { ProgressStep } from './bookings.insights';
import type { getDetailStyles } from './bookingDetail.styles';

type T = ReturnType<typeof useTranslation>;

/** "today", "tomorrow", "in 11 days", "3 days ago". */
export function relativeDay(days: number, t: T['t'], tPlural: T['tPlural']): string {
  if (days === 0) return t('bookings.relative.today');
  if (days === 1) return t('bookings.relative.tomorrow');
  if (days === -1) return t('bookings.relative.yesterday');
  return days > 0
    ? tPlural('bookings.stat.inDays', days)
    : tPlural('bookings.relative.daysAgo', -days);
}

function describe(step: ProgressStep, { t, tPlural, format }: T): { label: string; sub: string } {
  switch (step.key) {
    case 'confirmed':
      return {
        label: t('bookings.progress.confirmed'),
        sub: step.state === 'current' ? t('bookings.progress.waitingForYou') : '',
      };
    case 'contract':
      if (step.status === 'SIGNED') {
        return {
          label: t('bookings.progress.contractSigned'),
          sub: step.at ? format.dayMonth(step.at) : '',
        };
      }
      return {
        label: t('bookings.progress.contract'),
        sub:
          step.status === 'SENT'
            ? t('bookings.progress.sentOn', { date: step.at ? format.dayMonth(step.at) : '' })
            : step.status === 'DRAFT'
              ? t('bookings.progress.draft')
              : t('bookings.progress.notCreated'),
      };
    case 'payment':
      switch (step.phase) {
        case 'paid':
          return { label: t('bookings.progress.paidInFull'), sub: format.eur(step.amountCents) };
        case 'deposit':
          return { label: t('bookings.progress.depositPaid'), sub: format.eur(step.amountCents) };
        case 'open':
          return {
            label: t('bookings.progress.deposit'),
            sub: t('bookings.list.open', { amount: format.eur(step.amountCents) }),
          };
        default:
          return { label: t('bookings.progress.deposit'), sub: t('bookings.progress.notInvoiced') };
      }
    case 'shoot':
      return {
        label: t('bookings.progress.shoot'),
        sub:
          step.state === 'current'
            ? `${format.dayMonth(step.date)} · ${relativeDay(step.days, t, tPlural)}`
            : format.dayMonth(step.date),
      };
    case 'gallery':
      if (step.photoCount !== null) {
        return {
          label: t('bookings.progress.galleryDelivered'),
          sub: tPlural('bookings.progress.photos', step.photoCount),
        };
      }
      return {
        label: t('bookings.progress.gallery'),
        sub:
          step.state === 'current'
            ? t('bookings.progress.notCreated')
            : t('bookings.progress.afterShoot'),
      };
  }
}

/**
 * Where the booking stands, left to right: confirmed → contract → payment →
 * shoot → gallery. The same five steps the marketing page promises, read from
 * the booking's real state, so the photographer sees at a glance what used to
 * take a scroll through four sections.
 *
 * <p>An ordered list, because the order is the meaning; the step in progress
 * carries `aria-current="step"`, and each label names its own state ("Contract
 * signed", "Deposit paid"), so the dots are never the only signal.
 */
export function BookingProgress({
  steps,
  s,
  ink,
  line,
  vertical = false,
}: {
  steps: ProgressStep[];
  /** Phones: one step per row, label left and detail right, no connectors. */
  vertical?: boolean;
  s: ReturnType<typeof getDetailStyles>;
  /** Colour of a completed connector. */
  ink: string;
  /** Colour of a connector still ahead. */
  line: string;
}) {
  const tr = useTranslation();
  if (vertical) {
    return (
      <div style={s.progressBox}>
        <ol aria-label={tr.t('bookings.progress.aria')} style={{ ...s.stepList, gap: 14 }}>
          {steps.map((step) => {
            const { label, sub } = describe(step, tr);
            return (
              <li
                key={step.key}
                aria-current={step.state === 'current' ? 'step' : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <Dot state={step.state} s={s} />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      ...s.stepLabel,
                      marginTop: 0,
                      ...(step.state === 'todo' ? { color: s.stepSub.color } : null),
                    }}
                  >
                    {label}
                  </span>
                  {sub && <span style={s.stepSub}>{sub}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }
  return (
    <div style={s.progressBox}>
      <ol
        aria-label={tr.t('bookings.progress.aria')}
        style={{
          ...s.stepList,
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((step, i) => {
          const { label, sub } = describe(step, tr);
          const last = i === steps.length - 1;
          return (
            <li
              key={step.key}
              style={{ minWidth: 0 }}
              aria-current={step.state === 'current' ? 'step' : undefined}
            >
              <div style={s.stepTrack}>
                <Dot state={step.state} s={s} />
                <span
                  aria-hidden
                  style={{
                    ...s.stepLine,
                    background: last ? 'transparent' : step.state === 'done' ? ink : line,
                  }}
                />
              </div>
              <div
                style={{
                  ...s.stepLabel,
                  ...(step.state === 'todo' ? { color: s.stepSub.color } : null),
                }}
              >
                {label}
              </div>
              {sub && <div style={s.stepSub}>{sub}</div>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Dot({
  state,
  s,
}: {
  state: ProgressStep['state'];
  s: ReturnType<typeof getDetailStyles>;
}) {
  if (state === 'done') {
    return (
      <span style={s.stepDotDone}>
        <CheckIcon />
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span style={s.stepDotCurrent}>
        <span style={s.stepDotCurrentInner} />
      </span>
    );
  }
  return <span style={s.stepDotTodo} />;
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
