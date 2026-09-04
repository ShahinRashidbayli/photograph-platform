import Link from 'next/link';

/**
 * The statutory footer on a photographer's public pages.
 *
 * <p>§5 DDG requires the Impressum to be reachable from every page of a
 * commercial presence, and the established German standard is "two clicks,
 * clearly labelled" — hence a permanent footer link rather than a link buried
 * in a menu. The wording must stay literally "Impressum" and "Datenschutz":
 * courts have repeatedly held that creative labels ("Legal", "About us") do not
 * satisfy the duty.
 *
 * <p>Rendered on the portfolio and the request form both, because the request
 * form is exactly where personal data is collected and therefore where the
 * privacy notice must be one click away.
 */
export function PhotographerLegalFooter({
  subdomain,
  displayName,
  muted = '#64748B',
  border = '#E2E8F0',
}: Readonly<{
  subdomain: string;
  displayName?: string;
  muted?: string;
  border?: string;
}>) {
  const base = `/p/${encodeURIComponent(subdomain)}`;
  const linkStyle = {
    color: muted,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    fontSize: '0.85rem',
  } as const;

  return (
    <footer
      style={{
        marginTop: 48,
        paddingTop: 20,
        borderTop: `1px solid ${border}`,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ fontSize: '0.85rem', color: muted }}>
        {displayName ?? subdomain}
      </span>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <Link href={`${base}/impressum`} style={linkStyle}>
          Impressum
        </Link>
        <Link href={`${base}/datenschutz`} style={linkStyle}>
          Datenschutz
        </Link>
      </nav>
    </footer>
  );
}
