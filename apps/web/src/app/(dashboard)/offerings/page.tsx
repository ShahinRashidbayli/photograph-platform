'use client';

import { PlannedArea } from '@/components/PlannedArea';

/**
 * Two roadmap ideas, one screen: from the seller's side, running a workshop
 * and coaching someone are the same act of publishing what you know. Browsing
 * what others teach is the other half, at /community/learning.
 *
 * <p>Everything about how a not-yet-built area presents itself lives in
 * {@link PlannedArea} — see its notes for why these are pages rather than
 * dead links or mock screens.
 */
export default function Page() {
  return (
    <PlannedArea
      titleKey={'nav.offerings'}
      leadKey={'roadmap.area.offerings'}
      ideaKeys={['TRAINING', 'WORKSHOPS']}
    />
  );
}
