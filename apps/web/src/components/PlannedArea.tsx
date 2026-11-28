'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useThemeStore } from '@/store/themeStore';
import { getColors, pageTitle } from '@/lib/design-tokens';
import { Alert, Card, Note } from '@/components/ui';
import { ComingSoon } from '@/components/ComingSoon';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { ideasFor, type RoadmapIdea } from '@/lib/roadmap';
import { useRoadmapInterest, useToggleRoadmapInterest } from '@/hooks/useRoadmapInterest';

/**
 * One idea, with the control that is the point of showing it.
 *
 * <p>A checkbox, not a button. "I want this" is a state the studio is in and
 * can leave, and a button that turns into "Thanks!" hides whether the answer
 * was recorded.
 */
export function RoadmapIdeaCard({
  idea,
  wanted,
  disabled,
  onChange,
}: {
  idea: RoadmapIdea;
  wanted: boolean;
  disabled: boolean;
  /** No argument: the hook decides the direction — see `useToggleRoadmapInterest`. */
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);

  return (
    <Card>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t(idea.titleKey)}</h2>
        <ComingSoon size="sm" />
      </div>

      <p style={{ fontSize: '0.9rem', color: c.textMuted, lineHeight: 1.6, margin: '8px 0 0' }}>
        {t(idea.bodyKey)}
      </p>

      {idea.noteKey && (
        <p
          style={{
            fontSize: '0.82rem',
            color: c.textMuted,
            lineHeight: 1.5,
            margin: '6px 0 0',
            opacity: 0.85,
          }}
        >
          {t(idea.noteKey)}
        </p>
      )}

      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 9,
          marginTop: 14,
          fontSize: '0.87rem',
          fontWeight: wanted ? 700 : 500,
          color: wanted ? c.primaryText : c.textMuted,
          cursor: disabled ? 'wait' : 'pointer',
        }}
      >
        <input type="checkbox" checked={wanted} disabled={disabled} onChange={() => onChange()} />
        {wanted ? t('roadmap.wanted') : t('roadmap.want')}
      </label>
    </Card>
  );
}

/**
 * What a sidebar row that is not built yet opens.
 *
 * <h2>Why these are pages and not a 404 or a mock</h2>
 * A row in the sidebar is a promise that something is there. The two usual
 * ways of keeping it are both worse than this one: a built-looking screen
 * filled with plausible sample data, which this product has already been burnt
 * by — the client Documents page once showed a fabricated contract "awaiting
 * signature" and clients read invented legal statements as their own — or a
 * dead link, which teaches people the nav lies.
 *
 * <p>So the row opens a page that says, in the conditional, what would be here
 * and asks the one question worth asking about an unbuilt thing: do you want
 * it. That answer is the same `/api/roadmap/interest` signal the roadmap list
 * records, and it is why these pages carry the control rather than pointing at
 * a list somewhere else — the moment a photographer is most able to say
 * whether they want a feature is the moment they went looking for it.
 *
 * <p>The disclaimer is stated once at the top and carried after that by the
 * badge on each idea, which is also how the roadmap page does it.
 */
export function PlannedArea({
  titleKey,
  leadKey,
  ideaKeys,
}: {
  /** The sidebar's own label for this row — the page is what that row opened. */
  titleKey: TranslationKey;
  /** One sentence naming which half of the feature this is. */
  leadKey: TranslationKey;
  ideaKeys: readonly string[];
}) {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);

  const { data: interested, isLoading, isError } = useRoadmapInterest();
  const toggle = useToggleRoadmapInterest();
  const wanted = new Set(interested ?? []);
  const ideas = ideasFor(ideaKeys);

  return (
    <div style={{ padding: '28px 28px 40px', maxWidth: 820, margin: '0 auto', color: c.text }}>
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 6,
        }}
      >
        <h1 style={{ ...pageTitle, margin: 0 }}>{t(titleKey)}</h1>
        <ComingSoon size="md" />
      </div>
      <p style={{ fontSize: '0.95rem', color: c.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
        {t(leadKey)}
      </p>

      <Note style={{ marginBottom: 20 }}>{t('roadmap.disclaimer')}</Note>

      {isError && (
        <Alert tone="danger" style={{ marginBottom: 16 }}>
          {t('roadmap.loadError')}
        </Alert>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ideas.map((idea) => (
          <RoadmapIdeaCard
            key={idea.key}
            idea={idea}
            wanted={wanted.has(idea.key)}
            disabled={isLoading}
            onChange={() => toggle(idea.key)}
          />
        ))}
      </div>

      <p
        style={{ fontSize: '0.82rem', color: c.textMuted, lineHeight: 1.55, margin: '22px 2px 0' }}
      >
        {t('roadmap.footnote')}
      </p>

      {/* The full list is no longer a sidebar row, so each of these pages is
          the way back to it. */}
      <Link
        href="/roadmap"
        style={{
          display: 'inline-block',
          marginTop: 14,
          marginLeft: 2,
          fontSize: '0.87rem',
          fontWeight: 600,
          color: c.primaryText,
          textDecoration: 'none',
        }}
      >
        {t('roadmap.area.seeAll')} →
      </Link>
    </div>
  );
}
