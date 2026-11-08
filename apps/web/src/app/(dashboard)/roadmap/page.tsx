'use client';

import React, { useMemo } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { getColors, pageTitle } from '@/lib/design-tokens';
import { Alert, Note } from '@/components/ui';
import { useTranslation } from '@/lib/i18n';
import { ROADMAP_IDEAS } from '@/lib/roadmap';
import { RoadmapIdeaCard } from '@/components/PlannedArea';
import { useRoadmapInterest, useToggleRoadmapInterest } from '@/hooks/useRoadmapInterest';

/**
 * What is being considered next, all of it in one place.
 *
 * <h2>Why this is a list and not six screens</h2>
 * The obvious way to "show" a future feature is to build its screen with
 * plausible sample data. This product has already learned what that costs: the
 * client Documents page once rendered a fabricated contract "awaiting
 * signature" and a model release marked SIGNED, and clients read invented legal
 * statements as their own. `landing.claims.test.tsx` now enforces the rule that
 * came out of it — nothing may be presented as built until it is.
 *
 * <p>So none of these has a working screen. Each is a paragraph saying plainly
 * what it would do, marked as not built, with one control: whether this studio
 * wants it. That control is the reason the page exists rather than being a
 * changelog — six ideas, one can be built first, and the order is currently a
 * guess. `GET /api/roadmap/interest` turns it into a count.
 *
 * <p>It is no longer a sidebar row. Four of the six now have rows of their own,
 * each opening a {@link PlannedArea} that shows the one or two ideas behind it
 * and carries the same checkbox — a photographer is most able to say whether
 * they want a feature at the moment they went looking for it. This page is
 * what is left over: the whole list, still reachable, and linked from every one
 * of those pages.
 */
export default function RoadmapPage() {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const c = useMemo(() => getColors(theme), [theme]);

  const { data: interested, isLoading, isError } = useRoadmapInterest();
  const toggle = useToggleRoadmapInterest();
  const wanted = new Set(interested ?? []);

  return (
    <div style={{ padding: '28px 28px 40px', maxWidth: 820, margin: '0 auto', color: c.text }}>
      <h1 style={pageTitle}>{t('roadmap.title')}</h1>
      <p style={{ fontSize: '0.95rem', color: c.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
        {t('roadmap.subtitle')}
      </p>

      {/* Said once, at the top, rather than repeated on every card. The badge on
          each idea carries it from there. */}
      <Note style={{ marginBottom: 20 }}>{t('roadmap.disclaimer')}</Note>

      {isError && (
        <Alert tone="danger" style={{ marginBottom: 16 }}>
          {t('roadmap.loadError')}
        </Alert>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ROADMAP_IDEAS.map((idea) => (
          <RoadmapIdeaCard
            key={idea.key}
            idea={idea}
            wanted={wanted.has(idea.key)}
            disabled={isLoading}
            onChange={(next) => toggle.mutate({ feature: idea.key, wanted: next })}
          />
        ))}
      </div>

      <p
        style={{
          fontSize: '0.82rem',
          color: c.textMuted,
          lineHeight: 1.55,
          margin: '22px 2px 0',
        }}
      >
        {t('roadmap.footnote')}
      </p>
    </div>
  );
}
