import { fonts, getColors, radius, fontSize, type Theme } from '@/lib/design-tokens';

/**
 * Auth surface styles — derived from the app design tokens so the login /
 * register / magic-link screens share the dashboard's violet brand and its
 * light/dark theming instead of a stale hard-coded blue palette.
 *
 * `getAuthStyles(theme)` is the source of truth. `authStyles` is a static
 * light-mode snapshot kept for back-compat with pages that don't yet read the
 * theme store (verify-email, customer verify).
 */
export const getAuthStyles = (theme: Theme) => {
  const c = getColors(theme);
  const isDark = c.isDark;

  return {
    page: {
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column' as const,
      background: isDark
        ? 'radial-gradient(circle at 50% -10%, rgba(99, 102, 241, 0.10), transparent 55%), #0A0A0C'
        : 'linear-gradient(135deg, #F7F8FB 0%, #EEF2FF 100%)',
      color: c.text,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    navbar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '20px 32px',
      borderBottom: `1px solid ${c.border}`,
      background: isDark ? 'rgba(20, 20, 24, 0.72)' : 'rgba(255, 255, 255, 0.72)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      position: 'sticky' as const,
      top: 0,
      zIndex: 100,
    },
    navBrand: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '1.1rem',
      fontWeight: 700,
      color: c.text,
      textDecoration: 'none',
      cursor: 'pointer',
    },
    navLogo: {
      width: '32px',
      height: '32px',
      background: c.text,
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: c.surface,
      fontSize: '18px',
      fontWeight: 700,
    },
    navRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    },
    navButton: {
      padding: '10px 20px',
      fontSize: '0.9rem',
      fontWeight: 600,
      border: `1px solid ${c.border}`,
      background: 'transparent',
      borderRadius: radius.control,
      cursor: 'pointer',
      color: c.text,
      textDecoration: 'none',
      transition: 'all 0.2s',
    },
    navButtonPrimary: {
      background: c.primarySolid,
      color: '#FFFFFF',
      border: 'none',
      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.30)',
    },
    navButtonPrimaryHover: {
      background: c.primarySolidHover,
      transform: 'translateY(-1px)',
      boxShadow: '0 6px 16px rgba(99, 102, 241, 0.38)',
    },
    // Round icon-only control (theme toggle) that matches the nav buttons.
    themeToggle: {
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: `1px solid ${c.border}`,
      background: 'transparent',
      borderRadius: radius.pill,
      cursor: 'pointer',
      fontSize: '16px',
      lineHeight: 1,
      color: c.text,
      transition: 'all 0.2s',
    },

    container: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    },
    content: {
      width: '100%',
      maxWidth: '440px',
    },
    card: {
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: radius.card,
      padding: '40px 36px',
      boxShadow: c.elevatedShadow,
    },
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

    // Step indicators
    stepIndicators: {
      display: 'flex',
      justifyContent: 'center',
      gap: '12px',
      marginBottom: '24px',
    },
    stepCircle: {
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'default',
    },
    stepActive: {
      background: c.primarySolid,
      color: '#FFFFFF',
    },
    stepDone: {
      background: c.primarySolid,
      color: '#FFFFFF',
    },
    stepNext: {
      background: 'transparent',
      border: `2px solid ${c.primary}`,
      color: c.primaryText,
    },
    stepInactive: {
      background: c.neutralBg,
      color: c.textSubtle,
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
    buttonSecondaryHover: {
      background: c.surfaceHover,
    },
    buttonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },

    // Alerts/Banners
    alertSuccess: {
      padding: '12px 14px',
      borderRadius: radius.control,
      fontSize: fontSize.base,
      marginBottom: '16px',
    },
    alertSuccessPhotographer: {
      background: c.primaryBg,
      color: c.primaryText,
      border: `1px solid ${c.primaryBorder}`,
    },
    alertSuccessClient: {
      background: c.successBg,
      color: c.successText,
      border: `1px solid ${c.successBorder}`,
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

    // Role selection cards
    roleCardContainer: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '18px',
      marginBottom: '28px',
    },
    roleCard: {
      padding: '20px',
      border: '2px solid transparent',
      borderRadius: radius.card,
      cursor: 'pointer',
      transition: 'all 0.2s',
      textAlign: 'center' as const,
      background: c.surface,
    },
    roleCardSelected: {
      border: `2px solid ${c.primary}`,
      boxShadow: `0 0 0 3px ${isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.14)'}`,
    },
    roleIcon: {
      fontSize: '44px',
      marginBottom: '14px',
    },
    roleLabel: {
      fontSize: '18px',
      fontWeight: 600,
      color: c.text,
      margin: '0 0 10px 0',
    },
    roleDescription: {
      fontSize: '14px',
      color: c.textMuted,
      margin: 0,
      lineHeight: '1.6',
    },

    // Badge
    badge: {
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: radius.control,
      fontSize: fontSize.xs,
      fontWeight: 600,
      marginBottom: '12px',
    },
    badgePhotographer: {
      background: c.primaryBg,
      color: c.primaryText,
    },
    badgeClient: {
      background: c.successBg,
      color: c.successText,
    },

    // Checkbox (for session types)
    checkboxContainer: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '10px',
      marginBottom: '16px',
    },
    checkboxLabel: {
      display: 'flex',
      alignItems: 'center',
      padding: '10px 12px',
      border: `1px solid ${c.border}`,
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: fontSize.base,
      transition: 'all 0.2s',
    },
    checkboxLabelSelected: {
      background: c.primaryBg,
      border: `1px solid ${c.primary}`,
      color: c.primaryText,
      fontWeight: 500,
    },
    checkbox: {
      width: '16px',
      height: '16px',
      marginRight: '8px',
      cursor: 'pointer',
      accentColor: c.primary,
    },

    // Links & Footer text
    link: {
      color: c.primaryText,
      textDecoration: 'none',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'color 0.2s',
    },
    linkHover: {
      color: c.primaryStrong,
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

    // Success state
    successIcon: {
      fontSize: '48px',
      textAlign: 'center' as const,
      marginBottom: '16px',
    },
    successText: {
      textAlign: 'center' as const,
      fontSize: '14px',
      color: c.textMuted,
    },

    // Button group (for nav buttons)
    buttonGroup: {
      display: 'flex',
      gap: '12px',
      marginTop: '24px',
    },
    buttonGroupItem: {
      flex: 1,
    },
  };
};

export type AuthStyles = ReturnType<typeof getAuthStyles>;

/** Static light-mode snapshot for pages that don't read the theme store yet. */
export const authStyles = getAuthStyles('light');
