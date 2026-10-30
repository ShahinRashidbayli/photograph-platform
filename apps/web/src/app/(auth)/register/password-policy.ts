/**
 * The password rule the sign-up form applies, and the meter that reports on it.
 *
 * Extracted from the page so the two can be tested against each other. They
 * disagreed: the meter scored composition independently of the length
 * requirement, so `passw0rd` — 8 characters, letters and a digit — showed an
 * amber "Medium" and was then refused on submit for being under 10. Whatever
 * the meter says has to be consistent with what the form will accept, and the
 * only way to keep that true is to derive one from the other.
 */

/** Mirrors `RegisterRequest`'s bean validation on the server. */
export const MIN_PASSWORD_LENGTH = 10;

/** Exactly the rule the backend enforces — nothing weaker, nothing stricter. */
export function meetsPasswordPolicy(pw: string): boolean {
  return pw.length >= MIN_PASSWORD_LENGTH && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

export interface PasswordStrength {
  /** Language-neutral; the visible label is translated at render time. */
  level: '' | 'weak' | 'medium' | 'strong';
  /** 0–5, drives the width of the bar. */
  score: number;
}

/**
 * Strength, gated on the policy rather than scored independently of it.
 *
 * Anything the form would reject is `weak`, whatever its composition — a meter
 * that calls an unusable password "medium" tells the user they are finished when
 * they are not. Above the policy line, length and character variety earn the
 * remaining points.
 */
export function getPasswordStrength(pw: string): PasswordStrength {
  if (!pw) return { level: '', score: 0 };
  if (!meetsPasswordPolicy(pw)) return { level: 'weak', score: 1 };

  let score = 3;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return { level: score >= 5 ? 'strong' : 'medium', score };
}

/**
 * Turns what someone types into something that can actually be a hostname.
 *
 * Applied on every keystroke rather than on blur, so the field never shows a
 * value that would be rejected — a space becoming a hyphen as you type is
 * self-explanatory, whereas being told "invalid subdomain" after the fact is
 * not.
 */
export function slugifySubdomain(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 63);
}
