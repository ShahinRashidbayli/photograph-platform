'use client';

import { PlannedArea } from '@/components/PlannedArea';

/**
 * Community, and the only one of the six with no owned half at all — nothing
 * here would ever be yours to manage, which is what makes it the cheapest of
 * them to build.
 *
 * <p>Everything about how a not-yet-built area presents itself lives in
 * {@link PlannedArea} — see its notes for why these are pages rather than
 * dead links or mock screens.
 */
export default function Page() {
  return (
    <PlannedArea titleKey={'nav.gear'} leadKey={'roadmap.area.gear'} ideaKeys={['GEAR_GUIDE']} />
  );
}
