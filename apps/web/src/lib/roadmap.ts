import type { TranslationKey } from '@/lib/i18n';

/**
 * One thing being considered, as both the roadmap list and the individual
 * planned screens describe it.
 *
 * <p>The registry lives here rather than in either of those files because the
 * two are now views of the same six ideas: `/roadmap` shows all of them, and a
 * sidebar row that is not built yet shows the one or two that would fill it.
 * A second copy of this list is how those two drift into describing different
 * products.
 */
export interface RoadmapIdea {
  key: string;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  /** Rendered as a quiet line under the body — why this one is interesting. */
  noteKey?: TranslationKey;
}

/**
 * Order follows `docs/VISION_AND_EXTENSIBILITY.md` §4, which is also the order
 * of `DEVELOPMENT_PLAN.md` Phase 5 — impact first, so nothing quietly
 * re-prioritises the roadmap by rearranging it.
 */
export const ROADMAP_IDEAS: readonly RoadmapIdea[] = [
  {
    key: 'INSTAGRAM_GROWTH',
    titleKey: 'roadmap.instagram.title',
    bodyKey: 'roadmap.instagram.body',
    noteKey: 'roadmap.instagram.note',
  },
  {
    key: 'LOCATION_MAP',
    titleKey: 'roadmap.map.title',
    bodyKey: 'roadmap.map.body',
    noteKey: 'roadmap.map.note',
  },
  {
    key: 'STUDIO_MARKETPLACE',
    titleKey: 'roadmap.studio.title',
    bodyKey: 'roadmap.studio.body',
  },
  {
    key: 'TRAINING',
    titleKey: 'roadmap.training.title',
    bodyKey: 'roadmap.training.body',
  },
  {
    key: 'WORKSHOPS',
    titleKey: 'roadmap.workshops.title',
    bodyKey: 'roadmap.workshops.body',
  },
  {
    key: 'GEAR_GUIDE',
    titleKey: 'roadmap.gear.title',
    bodyKey: 'roadmap.gear.body',
    noteKey: 'roadmap.gear.note',
  },
] as const;

/**
 * The ideas behind one planned area, in roadmap order.
 *
 * <p>Neither direction is one-to-one. Studio rental and teaching each split
 * across two sidebar rows — the half you run and the half you browse — and
 * `My offerings` covers two ideas at once, because a photographer selling a
 * workshop and a photographer selling coaching are doing the same thing from
 * where they are standing.
 */
export function ideasFor(keys: readonly string[]): RoadmapIdea[] {
  return ROADMAP_IDEAS.filter((idea) => keys.includes(idea.key));
}
