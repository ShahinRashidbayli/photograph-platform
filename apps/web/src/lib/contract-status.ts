import type { TranslationKey, useTranslation } from '@/lib/i18n';
import type { Contract } from '@/hooks/useContracts';

type I18n = ReturnType<typeof useTranslation>;

/**
 * The line under a contract's title: who it is for, and how far it got.
 *
 * <p>Every status but SIGNED used to read "Sent to {name}", so a draft nobody
 * had sent claimed it had been, and so did a withdrawn one. The badge beside it
 * names the status; this line has to agree with it. Shared by the booking
 * detail and the contracts screen, which had the same copy twice.
 */
export function contractSubline(
  contract: Pick<Contract, 'status' | 'recipientName' | 'signedAt'>,
  t: (_key: TranslationKey, _params?: Record<string, string>) => string,
  format: Pick<I18n['format'], 'monthDayYear'>
): string {
  const name = { name: contract.recipientName };
  switch (contract.status) {
    case 'SIGNED':
      // signedAt is set whenever the status is SIGNED; the fallback only keeps
      // a malformed row from rendering a date that is not there.
      return contract.signedAt
        ? t('contracts.signedOn', { date: format.monthDayYear(contract.signedAt) })
        : t('contracts.sentTo', name);
    case 'DRAFT':
      return t('contracts.draftFor', name);
    case 'CANCELLED':
      return t('contracts.withdrawnFor', name);
    default:
      return t('contracts.sentTo', name);
  }
}
