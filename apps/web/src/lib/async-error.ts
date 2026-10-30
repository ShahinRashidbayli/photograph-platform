import type { TranslationKey } from '@/lib/i18n';

/**
 * A failure held as data instead of as a finished sentence.
 *
 * <h2>Why not just store the translated string</h2>
 * `t` is memoised on the active language, so its identity changes when the
 * persisted language loads after mount and again on every language switch.
 * Storing `t('…')` in state forces every loader that can fail to close over
 * `t`, which puts `t` in its dependency array — and a `useCallback` with `t` in
 * its deps that an effect then depends on turns a language change into a
 * refetch.
 *
 * That is not theoretical here. It made five screens fetch their data twice on
 * mount for every German-speaking user, and it made the billing-profile form
 * overwrite whatever the photographer had typed with the server's values the
 * moment they touched the language toggle — on a form holding their
 * Steuernummer and their VAT mode.
 *
 * <p>So a failure is recorded as *which* failure it was — a key we chose, or a
 * message the API wrote — and turned into words at render time, where `t` is
 * free to change as often as it likes.
 *
 * <p>The shape started life inside `StripePaymentModal` as a local `PayError`,
 * with a comment explaining exactly this hazard. It is here because the hazard
 * was never local to that file.
 */
export type AsyncError = { readonly key: TranslationKey } | { readonly text: string };

/**
 * The API's own error message when it wrote one, our key otherwise.
 *
 * <p>The server's message is preferred because it is the one that explains
 * *why* — an unconnected Stripe account, an invoice that has already been
 * paid — where a generic client-side line can only say that something didn't
 * work.
 */
export function asyncError(err: unknown, fallbackKey: TranslationKey): AsyncError {
  const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return typeof message === 'string' && message.trim()
    ? { text: message.trim() }
    : { key: fallbackKey };
}

/** Renders an {@link AsyncError} with the caller's active `t`. */
export function asyncErrorText(
  error: AsyncError | null | undefined,
  t: (_key: TranslationKey) => string
): string | null {
  if (!error) return null;
  return 'key' in error ? t(error.key) : error.text;
}
