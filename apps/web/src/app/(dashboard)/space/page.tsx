'use client';

import { PlannedArea } from '@/components/PlannedArea';

/**
 * The owned half of the studio marketplace. Searching other people's spaces is
 * the same feature seen from the other side, at /community/studios.
 *
 * <p>Everything about how a not-yet-built area presents itself lives in
 * {@link PlannedArea} — see its notes for why these are pages rather than
 * dead links or mock screens.
 */
export default function Page() {
  return (
    <PlannedArea
      titleKey={'nav.space'}
      leadKey={'roadmap.area.space'}
      ideaKeys={['STUDIO_MARKETPLACE']}
    />
  );
}
