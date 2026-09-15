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
 * SSR fetch of the public legal details.
 *
 * <p>`null` means one thing only: **there is no such photographer**. Every other
 * failure throws.
 *
 * <p>It used to collapse all of them to `null`, and the routes turn `null` into
 * `notFound()` — so a 429, a restarting API or a dropped connection rendered a
 * 404 on a page §5 DDG requires to stay reachable. Worse, that 404 is what ISR
 * then caches for the whole `revalidate` window, so a blip of a few seconds
 * removed a photographer's Impressum for five minutes and nothing in the app
 * knew it had happened. Throwing instead lets the route's error boundary handle
 * it, and Next does not cache a render that threw.
 */
export async function fetchPhotographerLegal(subdomain: string): Promise<PhotographerLegal | null> {
  const res = await fetch(`${API_BASE}/api/public/legal/${encodeURIComponent(subdomain)}`, {
    next: { revalidate: 300 },
  });
  // The only answer that means "this photographer does not exist".
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`legal fetch failed for ${subdomain}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as PhotographerLegal;
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
