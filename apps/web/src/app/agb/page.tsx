import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { AGB } from '@/lib/legal-content';

export const metadata: Metadata = {
  title: 'AGB · Fotolio',
  description: 'Allgemeine Geschäftsbedingungen der Plattform und Muster-AGB für Fotograf:innen.',
};

export default function AgbPage() {
  return <LegalPageShell doc={AGB} />;
}
