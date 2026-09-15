'use client';

import { PlannedArea } from '@/components/PlannedArea';

/**
 * Community: the map belongs to everyone who adds to it, which includes this
 * studio but is not this studio's data.
 *
 * <p>Everything about how a not-yet-built area presents itself lives in
 * {@link PlannedArea} — see its notes for why these are pages rather than
 * dead links or mock screens.
 */
export default function Page() {
  return (
    <PlannedArea
      titleKey={'nav.locations'}
      leadKey={'roadmap.area.locations'}
      ideaKeys={['LOCATION_MAP']}
    />
  );
}
