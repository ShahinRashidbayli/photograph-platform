'use client';

import { FotolioLogo } from '@/components/FotolioLogo';
import { useThemeStore } from '@/store/themeStore';
import Link from 'next/link';
import { styles } from './landing.styles';

const themeColors = {
  light: {
    bg: '#F9FAFB',
    cardBg: '#FFFFFF',
    text: '#111827',
    subText: '#6B7280',
    border: '#E5E7EB',
    hover: '#F3F4F6',
    logo: '#0C4A6E',
    navHover: '#F8FAFC',
  },
  dark: {
    bg: '#111827',
    cardBg: '#1F2937',
    text: '#F3F4F6',
    subText: '#D1D5DB',
    border: '#374151',
    hover: '#334155',
    logo: '#FFFFFF',
    navHover: '#334155',
  },
};

export default function LandingPage() {
  const { theme, toggleTheme } = useThemeStore();
  const colors = themeColors[theme];

  return (
    <div
      style={{
        ...styles.page,
        background: colors.bg,
        color: colors.text,
      }}
    >
      {/* Navbar */}
      <nav
        style={{
          ...styles.navbar,
          borderColor: colors.border,
          background: colors.cardBg,
        }}
      >
        <Link href="/" style={{ ...styles.navLogo, display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <FotolioLogo theme={theme} showText={true} />
        </Link>

        <div style={styles.navRight}>
          <button
            onClick={toggleTheme}
            style={{
              ...styles.themeToggle,
              color: colors.text,
            }}
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          <Link
            href="/login"
            style={{
              ...styles.navButton,
              ...styles.navButtonOutline,
              color: colors.text,
              borderColor: colors.border,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = colors.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Sign in
          </Link>

          <Link
            href="/register"
            style={{
              ...styles.navButton,
              ...styles.navButtonPrimary,
            }}
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={styles.hero}>
        <div
          style={{
            ...styles.badge,
            background: theme === 'light' ? '#E0F2FE' : 'rgba(3, 105, 161, 0.15)',
            color: theme === 'light' ? '#0369A1' : '#38BDF8',
          }}
        >
          The all-in-one platform for photographers in Germany
        </div>

        <h1 style={styles.heroTitle}>
          Manage your bookings,<br />
          clients & galleries
        </h1>

        <p style={{ ...styles.heroSubline, color: colors.subText }}>
          Leads · Contracts · Stripe payments · Client gallery delivery · Built for German photographers
        </p>

        <div style={styles.heroActions}>
          <button
            style={{
              ...styles.ctaButton,
              ...styles.ctaButtonPrimary,
            }}
            onClick={() => (window.location.href = '/register')}
          >
            Start free 14-day trial
          </button>
          <button
            style={{
              ...styles.ctaButton,
              ...styles.ctaButtonOutline,
              color: colors.text,
              borderColor: colors.border,
              background: colors.hover,
            }}
          >
            View live demo
          </button>
        </div>

        <p style={{ ...styles.heroNote, color: colors.subText }}>
          No credit card required · Cancel anytime
        </p>
      </section>

      {/* Dual Persona Section */}
      <section style={styles.personaSection}>
        <h2 style={{ ...styles.sectionTitle, color: colors.text }}>
          Built for everyone in the shoot
        </h2>

        <div style={styles.personaGrid}>
          {/* For Photographers */}
          <div
            style={{
              ...styles.personaCard,
              background: colors.cardBg,
              borderColor: colors.border,
            }}
          >
            <div style={styles.personaIcon}>📸</div>
            <h3 style={{ ...styles.personaLabel, color: colors.text }}>For Photographers</h3>

            <ul style={styles.featureList}>
              <li style={styles.featureItem}>
                <span style={styles.checkmark}>✓</span>
                <span>Portfolio & Showcase</span>
              </li>
              <li style={styles.featureItem}>
                <span style={styles.checkmark}>✓</span>
                <span>Lead Management</span>
              </li>
              <li style={styles.featureItem}>
                <span style={styles.checkmark}>✓</span>
                <span>Online Bookings</span>
              </li>
              <li style={styles.featureItem}>
                <span style={styles.checkmark}>✓</span>
                <span>Contracts & Agreements</span>
              </li>
              <li style={styles.featureItem}>
                <span style={styles.checkmark}>✓</span>
                <span>Client Galleries</span>
              </li>
              <li style={styles.featureItem}>
                <span style={styles.checkmark}>✓</span>
                <span>Stripe Payments</span>
              </li>
            </ul>

            <Link
              href="/register"
              style={{
                ...styles.personaCta,
                color: '#2563EB',
              }}
            >
              Start free trial →
            </Link>
          </div>

          {/* For Clients */}
          <div
            style={{
              ...styles.personaCard,
              background: colors.cardBg,
              borderColor: colors.border,
            }}
          >
            <div style={styles.personaIcon}>💌</div>
            <h3 style={{ ...styles.personaLabel, color: colors.text }}>For Clients</h3>

            <ul style={styles.featureList}>
              <li style={styles.featureItem}>
                <span style={styles.checkmark}>✓</span>
                <span>Browse Portfolios</span>
              </li>
              <li style={styles.featureItem}>
                <span style={styles.checkmark}>✓</span>
                <span>Book Online</span>
              </li>
              <li style={styles.featureItem}>
                <span style={styles.checkmark}>✓</span>
                <span>View Galleries</span>
              </li>
              <li style={styles.featureItem}>
                <span style={styles.checkmark}>✓</span>
                <span>Sign Contracts</span>
              </li>
            </ul>

            <Link
              href="/register"
              style={{
                ...styles.personaCta,
                color: '#2563EB',
              }}
            >
              Find a photographer →
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section style={styles.pricingSection}>
        <h2 style={{ ...styles.sectionTitle, color: colors.text }}>
          Simple, transparent pricing
        </h2>

        <div style={styles.pricingGrid}>
          {/* Starter */}
          <div
            style={{
              ...styles.pricingCard,
              background: colors.cardBg,
              borderColor: colors.border,
            }}
          >
            <div style={{ ...styles.pricingTier, color: colors.subText }}>Starter</div>
            <div style={styles.pricingPrice}>
              <span style={styles.pricingCurrency}>€</span>19<span style={{ fontSize: '0.9rem' }}>/mo</span>
            </div>
            <div style={{ ...styles.pricingPeriod, color: colors.subText }}>Billed monthly</div>

            <ul style={styles.pricingFeatures}>
              <li style={styles.pricingFeatureItem}>
                <span style={{ color: '#10B981' }}>✓</span>
                <span>Portfolio & Website</span>
              </li>
              <li style={styles.pricingFeatureItem}>
                <span style={{ color: '#10B981' }}>✓</span>
                <span>Lead Management</span>
              </li>
              <li style={styles.pricingFeatureItem}>
                <span style={{ color: '#10B981' }}>✓</span>
                <span>Online Bookings</span>
              </li>
              <li style={styles.pricingFeatureItem}>
                <span style={{ color: '#10B981' }}>✓</span>
                <span>10 GB Storage</span>
              </li>
            </ul>

            <button
              onClick={() => (window.location.href = '/register')}
              style={{
                ...styles.ctaButton,
                ...styles.ctaButtonOutline,
                width: '100%',
                color: colors.text,
                borderColor: colors.border,
                background: colors.hover,
              }}
            >
              Get started
            </button>
          </div>

          {/* Pro (Highlighted) */}
          <div
            style={{
              ...styles.pricingCard,
              ...styles.pricingCardHighlighted,
              background: colors.cardBg,
              borderColor: '#2563EB',
            }}
          >
            <div style={styles.pricingBadge}>Most popular</div>

            <div style={{ ...styles.pricingTier, color: colors.subText }}>Pro</div>
            <div style={styles.pricingPrice}>
              <span style={styles.pricingCurrency}>€</span>39<span style={{ fontSize: '0.9rem' }}>/mo</span>
            </div>
            <div style={{ ...styles.pricingPeriod, color: colors.subText }}>Billed monthly</div>

            <ul style={styles.pricingFeatures}>
              <li style={styles.pricingFeatureItem}>
                <span style={{ color: '#10B981' }}>✓</span>
                <span>Everything in Starter</span>
              </li>
              <li style={styles.pricingFeatureItem}>
                <span style={{ color: '#10B981' }}>✓</span>
                <span>Stripe Integration</span>
              </li>
              <li style={styles.pricingFeatureItem}>
                <span style={{ color: '#10B981' }}>✓</span>
                <span>Contracts & Agreements</span>
              </li>
              <li style={styles.pricingFeatureItem}>
                <span style={{ color: '#10B981' }}>✓</span>
                <span>CRM & Client Management</span>
              </li>
              <li style={styles.pricingFeatureItem}>
                <span style={{ color: '#10B981' }}>✓</span>
                <span>Bilingual Support</span>
              </li>
            </ul>

            <button
              onClick={() => (window.location.href = '/register')}
              style={{
                ...styles.ctaButton,
                ...styles.ctaButtonPrimary,
                width: '100%',
              }}
            >
              Get started
            </button>
          </div>

          {/* Studio */}
          <div
            style={{
              ...styles.pricingCard,
              background: colors.cardBg,
              borderColor: colors.border,
            }}
          >
            <div style={{ ...styles.pricingTier, color: colors.subText }}>Studio</div>
            <div style={styles.pricingPrice}>
              <span style={styles.pricingCurrency}>€</span>79<span style={{ fontSize: '0.9rem' }}>/mo</span>
            </div>
            <div style={{ ...styles.pricingPeriod, color: colors.subText }}>Billed monthly</div>

            <ul style={styles.pricingFeatures}>
              <li style={styles.pricingFeatureItem}>
                <span style={{ color: '#10B981' }}>✓</span>
                <span>Everything in Pro</span>
              </li>
              <li style={styles.pricingFeatureItem}>
                <span style={{ color: '#10B981' }}>✓</span>
                <span>Up to 3 Photographers</span>
              </li>
              <li style={styles.pricingFeatureItem}>
                <span style={{ color: '#10B981' }}>✓</span>
                <span>Analytics & Reports</span>
              </li>
              <li style={styles.pricingFeatureItem}>
                <span style={{ color: '#10B981' }}>✓</span>
                <span>White-label Options</span>
              </li>
            </ul>

            <button
              onClick={() => (window.location.href = '/register')}
              style={{
                ...styles.ctaButton,
                ...styles.ctaButtonOutline,
                width: '100%',
                color: colors.text,
                borderColor: colors.border,
                background: colors.hover,
              }}
            >
              Get started
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ ...styles.footerSection, borderColor: colors.border }}>
        <div style={styles.footerContent}>
          <div style={styles.footerLeft}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FotolioLogo variant="compact" theme={theme} showText={false} />
              <span style={{ fontWeight: 600 }}>Fotolio</span>
            </div>
            <span style={{ color: colors.subText, marginLeft: '8px' }}>© 2025</span>
          </div>

          <div style={styles.footerLinks}>
            <Link
              href="/login"
              style={{
                ...styles.footerLink,
                color: colors.text,
              }}
            >
              Sign in
            </Link>
            <Link
              href="/register"
              style={{
                ...styles.footerLink,
                color: colors.text,
              }}
            >
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
