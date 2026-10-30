import {
  MIN_PASSWORD_LENGTH,
  getPasswordStrength,
  meetsPasswordPolicy,
  slugifySubdomain,
} from './password-policy';

describe('meetsPasswordPolicy', () => {
  it('requires the minimum length, a letter and a digit', () => {
    expect(meetsPasswordPolicy('Passwort12')).toBe(true);
    expect(meetsPasswordPolicy('Passwor1')).toBe(false); // 8 chars
    expect(meetsPasswordPolicy('PasswortAB')).toBe(false); // no digit
    expect(meetsPasswordPolicy('1234567890')).toBe(false); // no letter
    expect(meetsPasswordPolicy('')).toBe(false);
  });

  it('accepts exactly the minimum', () => {
    expect('Passwort12'.length).toBe(MIN_PASSWORD_LENGTH);
    expect(meetsPasswordPolicy('Passwort12')).toBe(true);
  });
});

describe('getPasswordStrength', () => {
  it('says nothing about an empty field', () => {
    expect(getPasswordStrength('')).toEqual({ level: '', score: 0 });
  });

  /**
   * The bug this module exists for: `passw0rd` has letters, a digit and eight
   * characters, which the old meter scored as amber "Medium" — immediately
   * before the form refused it for being under ten.
   */
  it('never rates a password the form would reject above weak', () => {
    for (const rejected of ['passw0rd', 'Ab1', 'nodigitshere', '1234567890123']) {
      expect(meetsPasswordPolicy(rejected)).toBe(false);
      expect(getPasswordStrength(rejected).level).toBe('weak');
    }
  });

  it('rates a password that only just qualifies as medium', () => {
    expect(getPasswordStrength('passwort12')).toEqual({ level: 'medium', score: 3 });
  });

  it('credits extra length', () => {
    expect(getPasswordStrength('passwortpasswort1').score).toBe(4);
  });

  it('reserves strong for length and full character variety', () => {
    expect(getPasswordStrength('Passwort-1234!')).toEqual({ level: 'strong', score: 5 });
  });

  /** Whatever the meter reports as usable, the policy must also accept. */
  it('agrees with the policy on every non-weak rating', () => {
    const samples = [
      '',
      'a',
      'passw0rd',
      'passwort12',
      'Passwort12',
      'Passwort-1234!',
      'nodigitsatall',
      '9999999999',
    ];
    for (const pw of samples) {
      const { level } = getPasswordStrength(pw);
      if (level === 'medium' || level === 'strong') {
        expect(meetsPasswordPolicy(pw)).toBe(true);
      }
    }
  });
});

describe('slugifySubdomain', () => {
  it('turns spaces into hyphens', () => {
    expect(slugifySubdomain('Anna Foto')).toBe('anna-foto');
  });

  it('drops characters a hostname cannot carry', () => {
    expect(slugifySubdomain('Anna & Föto!')).toBe('anna-fto');
  });

  it('collapses runs of hyphens', () => {
    expect(slugifySubdomain('anna   foto')).toBe('anna-foto');
    expect(slugifySubdomain('anna---foto')).toBe('anna-foto');
  });

  it('caps at the DNS label limit', () => {
    expect(slugifySubdomain('a'.repeat(80))).toHaveLength(63);
  });
});
