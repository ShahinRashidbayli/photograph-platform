interface FotolioLogoProps {
  variant?: 'brand' | 'compact' | 'hero';
  theme?: 'light' | 'dark';
  showText?: boolean;
  ariaLabel?: string;
}

const LOGO_VARIANTS = {
  brand: { icon: 24, text: 18, gap: 4 },
  compact: { icon: 18, text: 15, gap: 3 },
  hero: { icon: 40, text: 28, gap: 6 },
} as const;

const THEME_MAP = {
  light: {
    badge: '#0F172A',
    glyph: '#FFFFFF',
    text: '#111827',
    stroke: 'transparent',
  },
  dark: {
    badge: 'rgba(255, 255, 255, 0.08)',
    glyph: '#FFFFFF',
    text: '#F3F4F6',
    stroke: 'rgba(255, 255, 255, 0.16)',
  },
} as const;

export function FotolioLogo({
  variant = 'brand',
  theme = 'light',
  showText = true,
  ariaLabel = 'Fotolio',
}: Readonly<FotolioLogoProps>) {
  const sizing = LOGO_VARIANTS[variant];
  const palette = THEME_MAP[theme];
  const semanticProps = showText ? {} : { role: 'img' as const, 'aria-label': ariaLabel };

  return (
    <span
      {...semanticProps}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${sizing.gap}px`,
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      <svg
        width={sizing.icon}
        height={sizing.icon}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        focusable="false"
        shapeRendering="geometricPrecision"
      >
        <rect
          x="4"
          y="4"
          width="56"
          height="56"
          rx="18"
          fill={palette.badge}
          stroke={theme === 'dark' ? palette.stroke : 'transparent'}
        />
        <path d="M22 14H46L39 22H22V14Z" fill={palette.glyph} />
        <path d="M22 28H40L34 36H22V28Z" fill={palette.glyph} />
        <rect x="22" y="14" width="8" height="36" fill={palette.glyph} />
      </svg>
      {showText && (
        <span
          style={{
            fontSize: `${sizing.text}px`,
            fontWeight: 800,
            color: palette.text,
            letterSpacing: '-0.03em',
            margin: 0,
            lineHeight: 1,
            textRendering: 'optimizeLegibility',
          }}
        >
          otolio
        </span>
      )}
    </span>
  );
}
