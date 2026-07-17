import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { IMPRESSUM } from '@/lib/legal-content';

export const metadata: Metadata = {
  title: 'Impressum · Fotolio',
  description: 'Anbieterkennzeichnung gemäß § 5 DDG.',
};

export default function ImpressumPage() {
  return <LegalPageShell doc={IMPRESSUM} />;
}
