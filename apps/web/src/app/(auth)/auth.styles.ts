import { fonts, getColors, radius, fontSize, type Theme } from '@/lib/design-tokens';

/**
 * Auth surface styles — derived from the app design tokens so the login /
 * register / magic-link screens share the dashboard's violet brand and its
 * light/dark theming instead of a stale hard-coded blue palette.
 *
 * `getAuthStyles(theme)` is the only entry point, deliberately. There used to
 * be a second one — a `getAuthStyles('light')` snapshot "for pages that don't
 * yet read the theme store" — and the two pages still on it (email
 * confirmation, customer magic-link verify) rendered a white card to every
 * dark-theme user who clicked a link in their inbox. A styles module that can
 * be imported without a theme will eventually be, so it no longer can be.
 */
export const getAuthStyles = (theme: Theme) => {
  const c = getColors(theme);
  const isDark = c.isDark;

  return {
    header: {
      marginBottom: '28px',
    },
    title: {
      // Editorial serif display face, shared with the landing page headings so
      // the marketing site and the auth screens read as one brand.
      fontFamily: fonts.serif,
      fontSize: '2rem',
      fontWeight: 500,
      color: c.text,
      margin: '0 0 8px 0',
      lineHeight: 1.15,
      letterSpacing: '-0.02em',
    },
    subtitle: {
      fontSize: '0.95rem',
      color: c.textMuted,
      margin: 0,
      lineHeight: 1.5,
    },

    // Form groups
    formGroup: {
      marginBottom: '20px',
    },
    label: {
      display: 'block',
      fontSize: '0.85rem',
      fontWeight: 600,
      color: c.text,
      marginBottom: '8px',
      letterSpacing: '0.01em',
    },
    input: {
      width: '100%',
      padding: '12px 14px',
      fontSize: '0.95rem',
      border: `1px solid ${c.border}`,
      borderRadius: radius.control,
      color: c.text,
      background: c.surfaceAlt,
      boxSizing: 'border-box' as const,
      fontFamily: 'inherit',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    },
    // Use the `border` shorthand (not `borderColor`) so it doesn't clash with
    // the shorthand `border` set on `input` — mixing the two makes React warn
    // and can drop the property on the focus/blur re-render.
    inputFocus: {
      border: `1px solid ${c.primary}`,
      outline: 'none',
      boxShadow: `0 0 0 3px ${isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.14)'}`,
    },
    helperText: {
      fontSize: fontSize.sm,
      color: c.textSubtle,
      marginTop: '4px',
    },

    // Buttons
    button: {
      width: '100%',
      padding: '12px 18px',
      fontSize: '0.9rem',
      fontWeight: 600,
      border: 'none',
      borderRadius: radius.control,
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    buttonPrimary: {
      background: c.primarySolid,
      color: '#FFFFFF',
      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.30)',
    },
    buttonPrimaryHover: {
      background: c.primarySolidHover,
      transform: 'translateY(-1px)',
      boxShadow: '0 6px 16px rgba(99, 102, 241, 0.38)',
    },
    buttonSecondary: {
      background: 'transparent',
      border: `1px solid ${c.border}`,
      color: c.text,
    },
    buttonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },

    alertInfo: {
      background: c.infoBg,
      color: c.infoText,
      border: `1px solid ${c.infoBorder}`,
      padding: '12px 14px',
      borderRadius: radius.control,
      fontSize: fontSize.base,
      marginBottom: '16px',
    },
    alertError: {
      background: c.dangerBg,
      color: c.dangerText,
      border: `1px solid ${c.dangerBorder}`,
      padding: '14px 16px',
      borderRadius: radius.control,
      fontSize: '0.9rem',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },

    // Links & Footer text
    link: {
      color: c.primaryText,
      textDecoration: 'none',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'color 0.2s',
    },
    centerText: {
      textAlign: 'center' as const,
      fontSize: '0.9rem',
      color: c.textMuted,
      marginTop: '20px',
      lineHeight: 1.5,
    },
    divider: {
      textAlign: 'center' as const,
      fontSize: '0.85rem',
      color: c.textSubtle,
      margin: '24px 0',
      position: 'relative' as const,
    },
    dividerLine: {
      borderTop: `1px solid ${c.border}`,
      marginTop: '8px',
      marginBottom: '8px',
    },
  };
};
