import { Fragment, type ReactNode } from 'react';

interface TransProps {
  /** A translated string containing `{name}` placeholders. */
  template: string;
  /** What each placeholder becomes — links, `<strong>`, anything renderable. */
  values: Record<string, ReactNode>;
}

/**
 * A translated sentence with React nodes inside it.
 *
 * `t()` interpolates strings, which is enough until a sentence needs a link in
 * the middle of it — "I accept the AGB and the Datenschutzerklärung". The usual
 * workarounds are both bad: splitting it into three keys leaves translators
 * assembling a sentence out of fragments whose order they cannot change (and
 * German word order routinely differs), while `dangerouslySetInnerHTML` puts
 * markup into the dictionary and an XSS sink into the render path.
 *
 * So the whole sentence stays one translatable key with named placeholders, and
 * the nodes are substituted here. A placeholder with no matching value is left
 * as literal text rather than dropped, so a mismatch is visible in review
 * instead of silently deleting words. `npm run i18n:check` already enforces
 * that placeholders match across locales.
 */
export function Trans({ template, values }: Readonly<TransProps>) {
  // Capturing split: odd indices are the placeholder names.
  const parts = template.split(/\{(\w+)\}/g);

  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) {
          return part ? <Fragment key={i}>{part}</Fragment> : null;
        }
        const value = values[part];
        return <Fragment key={i}>{value === undefined ? `{${part}}` : value}</Fragment>;
      })}
    </>
  );
}
