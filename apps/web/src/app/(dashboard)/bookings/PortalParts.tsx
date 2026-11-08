'use client';

import React from 'react';
import type { Booking } from '@/types/api';
import { useTranslation } from '@/lib/i18n';
import {
  getBookingStatusMeta,
  getCustomerBookingStatusLabelKey,
  toneToVisual,
} from '@/lib/booking-status';
import type { getColors } from '@/lib/design-tokens';
import { occasionKey, type Step } from './customer.portal';
import { getPortalStyles, linkButton, pill, stepBar, stepText } from './customer.styles';

type Colors = ReturnType<typeof getColors>;

/** How the studio can be reached — its published Impressum contact, when filled in. */
export type StudioContact = {
  name: string | null;
  email: string | null;
  phone: string | null;
};

/** The occasion as words: a request-form code translated, studio free text as typed. */
export function useOccasion() {
  const { t } = useTranslation();
  return (eventType: string | null | undefined): string => {
    const key = occasionKey(eventType);
    if (key) return t(key);
    return eventType?.trim() || t('bookings.sessionFallback');
  };
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** The shoot's path, one segment per step, the client's own step in amber. */
export function StepBar({
  steps,
  booking,
  colors: c,
}: {
  steps: Step[];
  booking: Booking;
  colors: Colors;
}) {
  const { t, format } = useTranslation();
  const s = getPortalStyles(c);
  if (steps.length === 0) return null;

  const label = (step: Step): string => {
    switch (step.key) {
      case 'requested':
        return t('portal.step.requested');
      case 'confirmed':
        return t('portal.step.confirmed');
      case 'contract':
        return step.state === 'done' ? t('portal.step.contract') : t('portal.step.contractOpen');
      case 'payment':
        return step.state === 'done' || booking.totalAmountCents <= 0
          ? t('portal.step.payment')
          : t('portal.step.paymentProgress', {
              paid: format.eur(booking.amountPaidCents ?? 0),
              total: format.eur(booking.totalAmountCents),
            });
      case 'shoot':
        return t('portal.step.shoot');
      case 'photos':
        return t('portal.step.photos');
    }
  };

  return (
    <ol
      aria-label={t('portal.step.aria')}
      style={{ ...s.steps, gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((step) => (
        <li
          key={step.key}
          aria-current={step.state === 'current' ? 'step' : undefined}
          style={s.step}
        >
          <span aria-hidden style={stepBar(c, step.state)} />
          <span style={stepText(c, step.state)}>{label(step)}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The booking's status in the client's words. "Completed" claims photos only
 * once there is a gallery: the studio closes a booking when the shoot is done,
 * which can be weeks before anything is delivered.
 */
export function BookingStatusPill({
  booking,
  hasGallery,
  colors: c,
}: {
  booking: Booking;
  hasGallery: boolean;
  colors: Colors;
}) {
  const { t } = useTranslation();
  if (booking.status === 'COMPLETED') {
    return hasGallery ? (
      <span style={pill(c.successText, c.successBg)}>{t('portal.status.photosDelivered')}</span>
    ) : (
      <span style={pill(c.neutralText, c.neutralBg)}>{t('portal.status.done')}</span>
    );
  }
  const visual = toneToVisual(getBookingStatusMeta(booking.status).tone, c);
  return (
    <span style={pill(visual.color, visual.bg)}>
      {t(getCustomerBookingStatusLabelKey(booking.status))}
    </span>
  );
}

/** Who to ask, at the foot of the overview. */
export function ContactFooter({ studio, colors: c }: { studio: StudioContact; colors: Colors }) {
  const { t } = useTranslation();
  const s = getPortalStyles(c);
  const reach = [studio.email, studio.phone].filter(Boolean).join(' · ');
  const mail = linkButton(c, 'secondary');
  return (
    <footer style={s.footer}>
      {studio.name && (
        <span aria-hidden style={s.avatar}>
          {initialsOf(studio.name)}
        </span>
      )}
      <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>
          {studio.name
            ? t('portal.contact.title', { name: studio.name })
            : t('portal.contact.titleNoName')}
        </span>
        {reach && <span style={s.rowMeta}>{reach}</span>}
      </div>
      {studio.email && (
        <a href={`mailto:${studio.email}`} className={mail.className} style={mail.style}>
          {t('portal.contact.email')}
        </a>
      )}
    </footer>
  );
}

const ICON = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const PortalIcon = {
  contract: (
    <svg {...ICON}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  ),
  card: (
    <svg {...ICON}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h3" />
    </svg>
  ),
  photo: (
    <svg {...ICON}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  ),
  chevron: (
    <svg {...ICON} width={18} height={18}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  back: (
    <svg {...ICON} width={16} height={16}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  plus: (
    <svg {...ICON} width={16} height={16} strokeWidth={1.9}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  ),
};
