'use client';

import React, { useMemo } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { getColors } from '@/lib/design-tokens';
import { ComingSoon } from '@/components/ComingSoon';
import { ComingSoonButton } from '@/components/ComingSoonButton';

const PDF_ICON = (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 11.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

type DocStatus = 'AWAITING_SIGNATURE' | 'SIGNED' | 'APPROVED';
type ActionKind = 'primary' | 'outline' | 'link' | 'danger';

type DocAction = { label: string; kind: ActionKind };

type Document = {
  id: string;
  title: string;
  subtype?: string;
  meta: string;
  status: DocStatus;
  /** Amber note shown when the document needs the client to act. */
  actionNote?: string;
  actions: DocAction[];
};

// FE-first placeholder data until the documents / e-signature backend exists.
const DUMMY_DOCS: Document[] = [
  {
    id: 'doc-1',
    title: 'Photography contract',
    meta: 'Family shoot · 24 Jul 2026 · 3 pages',
    status: 'AWAITING_SIGNATURE',
    actionNote: 'Needs to be signed before your session.',
    actions: [
      { label: 'Read & sign', kind: 'primary' },
      { label: 'Preview', kind: 'outline' },
    ],
  },
  {
    id: 'doc-2',
    title: 'Image usage permission',
    subtype: 'Model Release',
    meta: '2 Jul 2026 · Granted for portfolio & social media',
    status: 'SIGNED',
    actions: [
      { label: 'Download PDF', kind: 'link' },
      { label: 'Revoke permission', kind: 'danger' },
    ],
  },
  {
    id: 'doc-3',
    title: 'Data protection consent',
    subtype: 'GDPR',
    meta: '28 Jun 2026 · Photos deleted 12 months after delivery',
    status: 'APPROVED',
    actions: [
      { label: 'Download PDF', kind: 'link' },
      { label: 'Delete my data', kind: 'danger' },
    ],
  },
];

const STATUS_LABEL: Record<DocStatus, string> = {
  AWAITING_SIGNATURE: 'Awaiting signature',
  SIGNED: 'Signed',
  APPROVED: 'Approved',
};

export default function DocumentsPage() {
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);

  return (
    <div
      style={{
        padding: '28px 28px 40px',
        maxWidth: '900px',
        margin: '0 auto',
        color: c.text,
        fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px' }}>Documents</h1>
      <p style={{ fontSize: '0.95rem', color: c.textMuted, marginBottom: '24px' }}>
        Contracts, image-usage permissions and data-protection consents.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {DUMMY_DOCS.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} colors={c} />
        ))}
      </div>

      <p style={{ fontSize: '0.78rem', color: c.textSubtle ?? c.textMuted, marginTop: '18px', lineHeight: 1.5 }}>
        All documents are stored on EU servers · simple electronic signature (not qualified) — BGB §127
      </p>
    </div>
  );
}

function DocumentCard({ doc, colors: c }: { doc: Document; colors: ReturnType<typeof getColors> }) {
  const awaiting = doc.status === 'AWAITING_SIGNATURE';
  const markerColor = awaiting ? c.warning : c.success;
  const badge = awaiting
    ? { bg: c.warningBg, color: c.warningText }
    : { bg: c.successBg, color: c.successText };

  return (
    <div
      style={{
        background: c.surface,
        border: `1px solid ${c.border}`,
        // Left accent carries the card's status colour — amber when awaiting a
        // signature, green once signed/approved — so the state reads at a glance.
        borderLeft: `4px solid ${markerColor}`,
        borderRadius: '14px',
        boxShadow: c.overlayShadow,
        padding: '18px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        {/* Status marker */}
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: '6px',
            flexShrink: 0,
            marginTop: '1px',
            border: `1.5px solid ${markerColor}`,
            background: 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!awaiting && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke={markerColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: c.text }}>
                {doc.title}
                {doc.subtype && (
                  <span style={{ fontWeight: 500, color: c.textMuted }}> — {doc.subtype}</span>
                )}
              </div>
              <div style={{ fontSize: '0.82rem', color: c.textMuted, marginTop: '3px' }}>{doc.meta}</div>
            </div>
            <span
              style={{
                padding: '3px 10px',
                borderRadius: '999px',
                fontSize: '0.72rem',
                fontWeight: 700,
                background: badge.bg,
                color: badge.color,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {STATUS_LABEL[doc.status]}
            </span>
          </div>

          {doc.actionNote && (
            <div style={{ fontSize: '0.83rem', fontWeight: 600, color: c.warningText, marginTop: '8px' }}>
              {doc.actionNote}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
            {doc.actions.map((a) => (
              <ComingSoonButton
                key={a.label}
                variant={a.kind}
                title={a.kind === 'link' ? 'PDF download coming soon' : 'Coming soon'}
                icon={a.kind === 'link' ? PDF_ICON : undefined}
              >
                {a.label}
              </ComingSoonButton>
            ))}
            <ComingSoon />
          </div>
        </div>
      </div>
    </div>
  );
}

