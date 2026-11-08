import type { TranslationKey } from '@/lib/i18n';

/**
 * Sample data for the product previews. Names are proper nouns and stay as
 * written; every label goes through the dictionaries and every date and amount
 * through the locale formatters, so a German visitor never reads "Sat 12 Jul"
 * or "€1,200" under German copy.
 *
 * The previews are pictures of the product, not claims about anyone's numbers.
 */

export type ChipTone = 'green' | 'amber' | 'blue' | 'grey' | 'solid';

const d = (month: number, day: number) => new Date(2026, month - 1, day);

export const LEADS: {
  name: string;
  typeKey: TranslationKey;
  date: Date | null;
  budget: { fromCents?: number; toCents: number };
  score: number;
}[] = [
  {
    name: 'Sarah M.',
    typeKey: 'landing.mock.type.wedding',
    date: d(9, 20),
    budget: { fromCents: 250_000, toCents: 350_000 },
    score: 92,
  },
  {
    name: 'Tom K.',
    typeKey: 'landing.mock.type.portrait',
    date: d(8, 4),
    budget: { fromCents: 30_000, toCents: 50_000 },
    score: 61,
  },
  {
    name: 'Jonas B.',
    typeKey: 'landing.mock.type.family',
    date: null,
    budget: { toCents: 30_000 },
    score: 34,
  },
  {
    name: 'Studio Weiß GmbH',
    typeKey: 'landing.mock.type.business',
    date: d(8, 12),
    budget: { toCents: 120_000 },
    score: 74,
  },
];

export const CONTRACTS: {
  name: string;
  contractKey: TranslationKey;
  date: Date | null;
  statusKey: TranslationKey;
  tone: ChipTone;
}[] = [
  {
    name: 'Lena & Kaan',
    contractKey: 'landing.product.contractWedding',
    date: d(5, 2),
    statusKey: 'landing.product.statusSigned',
    tone: 'green',
  },
  {
    name: 'Familie Meyer',
    contractKey: 'landing.product.contractPortrait',
    date: d(6, 28),
    statusKey: 'landing.product.statusSent',
    tone: 'amber',
  },
  {
    name: 'Julia T.',
    contractKey: 'landing.product.contractNewborn',
    date: null,
    statusKey: 'landing.product.statusDraft',
    tone: 'grey',
  },
  {
    name: 'Sophie & Luca',
    contractKey: 'landing.product.contractCouple',
    date: d(6, 14),
    statusKey: 'landing.product.statusSigned',
    tone: 'green',
  },
];

export const PAYMENTS: {
  name: string;
  typeKey: TranslationKey;
  amountCents: number;
  status: { key: TranslationKey; due?: Date };
  tone: ChipTone;
}[] = [
  {
    name: 'Lena & Kaan',
    typeKey: 'landing.product.payDepositSepa',
    amountCents: 48_000,
    status: { key: 'landing.product.statusReceived' },
    tone: 'green',
  },
  {
    name: 'Lena & Kaan',
    typeKey: 'landing.product.payBalance',
    amountCents: 192_000,
    status: { key: 'landing.product.statusDue', due: d(7, 19) },
    tone: 'amber',
  },
  {
    name: 'Sophie & Luca',
    typeKey: 'landing.product.payFullCard',
    amountCents: 65_000,
    status: { key: 'landing.product.statusReceived' },
    tone: 'green',
  },
  {
    name: 'Familie Meyer',
    typeKey: 'landing.product.payDepositCard',
    amountCents: 15_000,
    status: { key: 'landing.product.statusOpen' },
    tone: 'grey',
  },
];

export const PAYMENTS_RECEIVED_CENTS = 920_000;

export const INVOICES: {
  number: string;
  name: string;
  amountCents: number;
  statusKey: TranslationKey;
  tone: ChipTone;
}[] = [
  {
    number: 'RE-2026-041',
    name: 'Lena & Kaan',
    amountCents: 240_000,
    statusKey: 'landing.product.statusPartlyPaid',
    tone: 'amber',
  },
  {
    number: 'RE-2026-040',
    name: 'Studio Weiß GmbH',
    amountCents: 120_000,
    statusKey: 'landing.product.statusPaid',
    tone: 'green',
  },
  {
    number: 'RE-2026-039',
    name: 'Familie Meyer',
    amountCents: 45_000,
    statusKey: 'landing.product.statusOpen',
    tone: 'grey',
  },
  {
    number: 'RE-2026-038',
    name: 'Sophie & Luca',
    amountCents: 65_000,
    statusKey: 'landing.product.statusPaid',
    tone: 'green',
  },
];

/** The dates the hero card and the workflow cite. */
export const SAMPLE = {
  weddingDate: d(7, 12),
  contractSigned: d(5, 2),
  depositCents: 48_000,
  // One booking told three times (hero card, gallery, workflow): one count,
  // or the page contradicts itself.
  galleryPhotos: 248,
  /** The shoot slot the client picked — the "Booking" step's data. */
  shootAt: new Date(2026, 6, 12, 14, 0),
  galleryOnlineUntil: new Date(2027, 10, 30),
};
