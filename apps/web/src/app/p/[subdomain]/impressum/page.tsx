import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PhotographerLegalPage } from '@/components/legal/PhotographerLegalPage';
import { fetchPhotographerLegal } from '@/lib/photographer-legal';

export const revalidate = 300;

interface Props {
  params: Promise<{ subdomain: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params;
  const legal = await fetchPhotographerLegal(subdomain);
  const name = legal?.legalName ?? subdomain;
  return {
    title: `Impressum · ${name}`,
    // An Impressum has no SEO value and indexing one photographer's postal
    // address across search engines is not something they opted into.
    robots: { index: false, follow: true },
  };
}

export default async function PhotographerImpressumPage({ params }: Props) {
  const { subdomain } = await params;
  const legal = await fetchPhotographerLegal(subdomain);
  if (!legal) notFound();

  return <PhotographerLegalPage legal={legal} variant="impressum" />;
}
