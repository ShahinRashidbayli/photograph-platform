import { ImageResponse } from 'next/og';

/**
 * The card that renders when the landing page URL is pasted into WhatsApp,
 * Slack or LinkedIn.
 *
 * <p>Generated rather than committed as a PNG, for the same reason the rest of
 * the page has no stock imagery: a binary in `public/` is a file somebody has
 * to remember to re-export when the wording or the brand colour changes, and
 * the one that was referenced here first did not exist at all — the tag
 * pointed at a 404. Next renders this at build time and inlines the correct
 * absolute URL into `og:image` and `twitter:image`, so there is nothing to
 * keep in sync.
 *
 * <p>Deliberately typographic: the product's own screenshots are dashboards
 * full of sample client names, which is not what should represent it in a
 * shared link.
 */

export const alt = 'Fotolio — bookings, clients and galleries for photographers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '76px 84px',
        // The hero's own palette, flattened: satori supports linear-gradient
        // but not the blurred aurora blobs, so the card takes the colours
        // rather than attempting the effect and rendering it as hard bands.
        background: 'linear-gradient(135deg, #0A0A0C 0%, #14121F 55%, #1B1533 100%)',
        color: '#FFFFFF',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #7A66F5, #B06BE0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          F
        </div>
        <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.01em' }}>Fotolio</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div
          style={{
            display: 'flex',
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            maxWidth: 900,
          }}
        >
          Run the business. Keep the craft.
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#B9B7C6', maxWidth: 860 }}>
          Leads, bookings and private client galleries — one workspace for photographers.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 24 }}>
        <div style={{ display: 'flex', gap: 0, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: 12, height: 20, background: '#191919' }} />
          <div style={{ width: 12, height: 20, background: '#d1252b' }} />
          <div style={{ width: 12, height: 20, background: '#f2c200' }} />
        </div>
        <div style={{ display: 'flex', color: '#8F8DA0' }}>Made in Germany · DSGVO-konform</div>
      </div>
    </div>,
    size
  );
}
