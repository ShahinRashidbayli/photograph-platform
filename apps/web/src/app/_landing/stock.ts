/**
 * Stand-in photographs for the marketing page and the sign-in panel, until a
 * partner photographer's own work (with model releases) replaces them. Each
 * entry carries its credit; the Impressum's Bildnachweise are built from this
 * list, so replacing a file means replacing its entry too (or deleting it, for
 * a photograph of your own).
 *
 * All of them are Unsplash photographs from the years Unsplash published under
 * CC0, as mirrored on Wikimedia Commons (no API key, licence on record). The
 * first set came from Commons' general pool and looked like it: amateur frames
 * in a dozen colour casts. These were chosen as one body of work — soft, warm
 * light — and given one grade (warm, slightly desaturated, lifted blacks), so
 * frames by twenty photographers read as one studio's.
 *
 * Files are WebP: full-bleed frames 1600–1920px wide, tiles 900px on the long
 * edge (they render at ~320px). They are prepared by hand because the image
 * optimizer is off on purpose (next.config.mjs): whatever is in these folders
 * is exactly what a phone downloads.
 */
export type StockPhoto = {
  src: string;
  width: number;
  height: number;
  by: string;
  licence: string;
  source: string;
};

const COMMONS = 'https://commons.wikimedia.org/wiki/File:';

export const STOCK = {
  // ── Hero and the studio's booking page ────────────────────────────────────────
  sparks: {
    src: '/landing/stock/hero-sparks.webp',
    width: 1600,
    height: 1067,
    by: 'Shifaaz shamoon',
    licence: 'CC0',
    source: `${COMMONS}Maldives_wedding_(Unsplash).jpg`,
  },
  embrace: {
    src: '/landing/stock/booking-embrace.webp',
    width: 800,
    height: 1200,
    by: 'Brooke Cagle',
    licence: 'CC0',
    source: `${COMMONS}Bride_leans_into_husband_(Unsplash).jpg`,
  },
  // ── The client gallery: one wedding ───────────────────────────────────────────
  field: {
    src: '/landing/stock/cover-field.webp',
    width: 1920,
    height: 1275,
    by: 'Scott Webb',
    licence: 'CC0',
    source: `${COMMONS}London_wedding_blue_sky_clouds_(Unsplash).jpg`,
  },
  rings: {
    src: '/landing/stock/g-rings.webp',
    width: 900,
    height: 600,
    by: 'Petr Ovralov',
    licence: 'CC0',
    source: `${COMMONS}Bride_holds_wedding_bands_(Unsplash).jpg`,
  },
  brideBouquet: {
    src: '/landing/stock/g-bride-bouquet.webp',
    width: 601,
    height: 900,
    by: 'chuttersnap',
    licence: 'CC0',
    source: `${COMMONS}Bride_with_a_diverse_bouquet_(Unsplash).jpg`,
  },
  dress: {
    src: '/landing/stock/g-dress.webp',
    width: 601,
    height: 900,
    by: 'Josh Applegate',
    licence: 'CC0',
    source: `${COMMONS}Fort_Collins_wedding_embrace_(Unsplash).jpg`,
  },
  shoes: {
    src: '/landing/stock/g-shoes.webp',
    width: 900,
    height: 600,
    by: 'Tom The Photographer',
    licence: 'CC0',
    source: `${COMMONS}Wedding_Shoes_(Choo_Choo)_(Unsplash).jpg`,
  },
  bouquet: {
    src: '/landing/stock/g-bouquet.webp',
    width: 900,
    height: 600,
    by: 'Luis Tosta',
    licence: 'CC0',
    source: `${COMMONS}Wedding_Day_(Unsplash).jpg`,
  },
  veil: {
    src: '/landing/stock/g-veil.webp',
    width: 900,
    height: 598,
    by: 'Scott Webb',
    licence: 'CC0',
    source: `${COMMONS}Wedding_couple_at_old_building_(Unsplash_BLx6ystEhk).jpg`,
  },
  steps: {
    src: '/landing/stock/g-steps.webp',
    width: 900,
    height: 450,
    by: 'Josh Felise',
    licence: 'CC0',
    source: `${COMMONS}Wedding_day_shoes_(Unsplash).jpg`,
  },
  forest: {
    src: '/landing/stock/g-forest.webp',
    width: 900,
    height: 600,
    by: 'photo-nic.co.uk',
    licence: 'CC0',
    source: `${COMMONS}Wedding_walk_dark_forest_path_(Unsplash).jpg`,
  },
  // ── One frame per kind of shoot ───────────────────────────────────────────────
  wedding: {
    src: '/landing/stock/f-wedding.webp',
    width: 900,
    height: 600,
    by: 'Brooke Cagle',
    licence: 'CC0',
    source: `${COMMONS}Groom_follows_behind_bride_(Unsplash).jpg`,
  },
  portrait: {
    src: '/landing/stock/f-portrait.webp',
    width: 600,
    height: 900,
    by: 'Roksolana Zasiadko',
    licence: 'CC0',
    source: `${COMMONS}Soft_Curls_(Unsplash).jpg`,
  },
  family: {
    src: '/landing/stock/f-family.webp',
    width: 900,
    height: 600,
    by: 'Caroline Hernandez',
    licence: 'CC0',
    source: `${COMMONS}Father_and_Daughter_(Unsplash).jpg`,
  },
  newborn: {
    src: '/landing/stock/f-newborn.webp',
    width: 900,
    height: 643,
    by: 'Mindy Olson P',
    licence: 'CC0',
    source: `${COMMONS}Newborn_Baby_(Unsplash).jpg`,
  },
  business: {
    src: '/landing/stock/f-business.webp',
    width: 900,
    height: 601,
    by: 'rawpixel.com',
    licence: 'CC0',
    source: `${COMMONS}Man_working_on_laptop_outside_(Unsplash).jpg`,
  },
  couples: {
    src: '/landing/stock/f-couples.webp',
    width: 900,
    height: 600,
    by: 'Allef Vinicius',
    licence: 'CC0',
    source: `${COMMONS}Couple_embracing_in_cornfield_(Unsplash).jpg`,
  },
  event: {
    src: '/landing/stock/f-event.webp',
    width: 900,
    height: 600,
    by: 'Sweet Ice Cream Photography',
    licence: 'CC0',
    source: `${COMMONS}Wedding_reception_tables_and_benches_(Unsplash).jpg`,
  },
  reportage: {
    src: '/landing/stock/f-reportage.webp',
    width: 900,
    height: 617,
    by: 'Clem Onojeghuo',
    licence: 'CC0',
    source: `${COMMONS}Photographer_taking_a_picture_(Unsplash).jpg`,
  },
  // ── The sign-in pages' brand panel (components/AuthSplitLayout.tsx), credited here with the rest ───
  authPhotographer: {
    src: '/brand/auth-photographer.webp',
    width: 1600,
    height: 1067,
    by: 'Evan Kirby',
    licence: 'CC0',
    source: `${COMMONS}Fall_photographer_(Unsplash).jpg`,
  },
  authClient: {
    src: '/brand/auth-client.webp',
    width: 1600,
    height: 1067,
    by: 'freestocks.org',
    licence: 'CC0',
    source: `${COMMONS}Bride_and_groom_sit_by_pond_(Unsplash).jpg`,
  },
} satisfies Record<string, StockPhoto>;

/** The gallery cover at 144px, for the hero card's 44px thumbnail (not 1920px for 44). */
export const STOCK_THUMB = '/landing/stock/cover-field-thumb.webp';

/** One credit per photographer and licence, in first-use order. */
export function stockCredits(): { by: string; licence: string; source: string }[] {
  const seen = new Set<string>();
  const out: { by: string; licence: string; source: string }[] = [];
  for (const p of Object.values(STOCK)) {
    const key = `${p.by}|${p.licence}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ by: p.by, licence: p.licence, source: p.source });
  }
  return out;
}
