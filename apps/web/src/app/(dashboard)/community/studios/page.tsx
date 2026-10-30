'use client';

import { PlannedArea } from '@/components/PlannedArea';

/**
 * Community: other people's spaces. Listing your own is at /space.
 *
 * <p>Everything about how a not-yet-built area presents itself lives in
 * {@link PlannedArea} — see its notes for why these are pages rather than
 * dead links or mock screens.
 */
export default function Page() {
  return (
    <PlannedArea
      titleKey={'nav.studios'}
      leadKey={'roadmap.area.studios'}
      ideaKeys={['STUDIO_MARKETPLACE']}
    />
  );
}
