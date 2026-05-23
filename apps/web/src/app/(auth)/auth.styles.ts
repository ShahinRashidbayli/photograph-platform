export const authStyles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'linear-gradient(135deg, #F7F8FB 0%, #E0E7FF 100%)',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 32px',
    borderBottom: '1px solid #E2E8F0',
    background: '#FFFFFF',
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
    color: '#0F172A',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  navLogo: {
    width: '32px',
    height: '32px',
    background: '#0F172A',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
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
    border: '1px solid #E2E8F0',
    background: 'transparent',
    borderRadius: '10px',
    cursor: 'pointer',
    color: '#0F172A',
    textDecoration: 'none',
    transition: 'all 0.2s',
  },
  navButtonPrimary: {
    background: '#0F172A',
    color: '#FFFFFF',
    border: 'none',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
  },
  navButtonPrimaryHover: {
    background: '#1E293B',
    transform: 'translateY(-1px)',
    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.2)',
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
    maxWidth: '560px',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: '16px',
    padding: '48px 40px',
    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
  },
  header: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 8px 0',
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: '0.95rem',
    color: '#64748B',
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
    background: '#3B82F6',
    color: '#FFFFFF',
  },
  stepDone: {
    background: '#3B82F6',
    color: '#FFFFFF',
  },
  stepNext: {
    background: 'transparent',
    border: '2px solid #3B82F6',
    color: '#3B82F6',
  },
  stepInactive: {
    background: '#F1F5F9',
    color: '#94A3B8',
  },

  // Form groups
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#0F172A',
    marginBottom: '8px',
    letterSpacing: '0.01em',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '0.95rem',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    color: '#0F172A',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  inputFocus: {
    borderColor: '#3B82F6',
    outline: 'none',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
  },
  helperText: {
    fontSize: '12px',
    color: '#64748B',
    marginTop: '4px',
  },

  // Buttons
  button: {
    width: '100%',
    padding: '12px 18px',
    fontSize: '0.9rem',
    fontWeight: 600,
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  buttonPrimary: {
    background: '#0F172A',
    color: '#FFFFFF',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
  },
  buttonPrimaryHover: {
    background: '#1E293B',
    transform: 'translateY(-1px)',
    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.2)',
  },
  buttonSecondary: {
    background: 'transparent',
    border: '1px solid #E2E8F0',
    color: '#0F172A',
  },
  buttonSecondaryHover: {
    background: '#F8FAFC',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },

  // Alerts/Banners
  alertSuccess: {
    padding: '12px 14px',
    borderRadius: '10px',
    fontSize: '13px',
    marginBottom: '16px',
  },
  alertSuccessPhotographer: {
    background: '#EFF6FF',
    color: '#1E40AF',
    border: '1px solid #BFDBFE',
  },
  alertSuccessClient: {
    background: '#F0FDF4',
    color: '#166534',
    border: '1px solid #BBDF26',
  },
  alertInfo: {
    background: '#F0F9FF',
    color: '#0C4A6E',
    border: '1px solid #BFDBFE',
    padding: '12px 14px',
    borderRadius: '10px',
    fontSize: '13px',
    marginBottom: '16px',
  },
  alertError: {
    background: '#FEF2F2',
    color: '#991B1B',
    border: '1px solid #FECACA',
    padding: '14px 16px',
    borderRadius: '10px',
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
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center' as const,
    background: '#FFFFFF',
  },
  roleCardSelected: {
    borderColor: '#3B82F6',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
  },
  roleIcon: {
    fontSize: '44px',
    marginBottom: '14px',
  },
  roleLabel: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#0F172A',
    margin: '0 0 10px 0',
  },
  roleDescription: {
    fontSize: '14px',
    color: '#64748B',
    margin: 0,
    lineHeight: '1.6',
  },

  // Badge
  badge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 600,
    marginBottom: '12px',
  },
  badgePhotographer: {
    background: '#EFF6FF',
    color: '#1E40AF',
  },
  badgeClient: {
    background: '#F0FDF4',
    color: '#166534',
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
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s',
  },
  checkboxLabelSelected: {
    background: '#EFF6FF',
    border: '1px solid #3B82F6',
    color: '#1E40AF',
    fontWeight: 500,
  },
  checkbox: {
    width: '16px',
    height: '16px',
    marginRight: '8px',
    cursor: 'pointer',
    accentColor: '#3B82F6',
  },

  // Links & Footer text
  link: {
    color: '#2563EB',
    textDecoration: 'none',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'color 0.2s',
  },
  linkHover: {
    color: '#1D4ED8',
  },
  centerText: {
    textAlign: 'center' as const,
    fontSize: '0.9rem',
    color: '#64748B',
    marginTop: '20px',
    lineHeight: 1.5,
  },
  divider: {
    textAlign: 'center' as const,
    fontSize: '0.85rem',
    color: '#94A3B8',
    margin: '24px 0',
    position: 'relative' as const,
  },
  dividerLine: {
    borderTop: '1px solid #E2E8F0',
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
    color: '#64748B',
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
