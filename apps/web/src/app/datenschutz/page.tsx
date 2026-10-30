import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { DATENSCHUTZ } from '@/lib/legal-content';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung · Fotolio',
  description: 'Informationen zur Datenverarbeitung nach Art. 13/14 DSGVO.',
};

export default function DatenschutzPage() {
  return <LegalPageShell doc={DATENSCHUTZ} />;
}
