/**
 * A photographer's own statutory disclosure details.
 *
 * <p>Distinct from `legal-content.ts`, which holds Fotolio's platform-level
 * Impressum / Datenschutz / AGB. Those cover Fotolio as the service operator.
 * A photographer's public portfolio and request form are their *own* commercial
 * presence: §5 DDG makes them individually liable for an Impressum there, and
 * under GDPR they are the controller for the client data their form collects.
 * Serving Fotolio's pages on their subdomain would leave them exposed.
 */

export interface PhotographerLegal {
  subdomain: string;
  legalName: string | null;
  legalStreet: string | null;
  legalPostalCode: string | null;
  legalCity: string | null;
  legalCountry: string | null;
  legalEmail: string | null;
  legalPhone: string | null;
  legalVatId: string | null;
  legalRegister: string | null;
  legalResponsible: string | null;
  privacyContactEmail: string | null;
  /**
   * Whether the mandatory §5 DDG fields are filled in. The pages render an
   * honest "not published yet" state when false rather than a half-empty
   * Impressum, which would look compliant while not being so.
   */
  complete: boolean;
}

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8080';

/**
 * SSR fetch of the public legal details. Mirrors the portfolio fetch: fully
 * public endpoint, subdomain is the only identifier, and every failure collapses
 * to `null` so the route can render notFound() instead of crashing.
 */
export async function fetchPhotographerLegal(
  subdomain: string
): Promise<PhotographerLegal | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/public/legal/${encodeURIComponent(subdomain)}`,
      { next: { revalidate: 300 } }
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error('legal fetch failed', subdomain, res.status);
      return null;
    }
    return (await res.json()) as PhotographerLegal;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('legal fetch error', subdomain, err);
    return null;
  }
}

/** Single-line postal address, skipping parts the photographer left blank. */
export function formatAddress(legal: PhotographerLegal): string {
  return [
    legal.legalStreet,
    [legal.legalPostalCode, legal.legalCity].filter(Boolean).join(' '),
    legal.legalCountry,
  ]
    .filter((part) => part && part.trim().length > 0)
    .join(', ');
}
