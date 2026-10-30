'use client';

import { PlannedArea } from '@/components/PlannedArea';

/**
 * The only one of the six with no community half — an Instagram account is
 * only ever your own, which is why this row needed no new part of the nav to
 * land in.
 *
 * <p>Everything about how a not-yet-built area presents itself lives in
 * {@link PlannedArea} — see its notes for why these are pages rather than
 * dead links or mock screens.
 */
export default function Page() {
  return (
    <PlannedArea
      titleKey={'nav.instagram'}
      leadKey={'roadmap.area.instagram'}
      ideaKeys={['INSTAGRAM_GROWTH']}
    />
  );
}
