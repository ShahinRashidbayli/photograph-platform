import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Every text pair on the landing page meets WCAG 2.2 AA, in each theme on its
 * own (#78, values from #82).
 *
 * <p>jsdom does not apply the global stylesheet, so no rendering test can see
 * a colour. This one reads the `--lp-*` and `--pv-*` values for both themes
 * straight out of `globals.css` instead, so it cannot drift from what ships:
 * change a token there and this test checks the new value.
 *
 * <p>Floors: 4.5:1 for text, 3:1 for large text (24 px and up), 3:1 for the
 * focus ring against the ground it sits on. The accent word is large but held
 * to 4.5:1 by choice — the display face's strokes are thin.
 */

type Rgb = [number, number, number];
type Rgba = { rgb: Rgb; a: number };
type Tokens = Record<string, string>;
type Theme = 'light' | 'dark';

const TEXT = 4.5;
const LARGE_TEXT = 3;
const FOCUS_RING = 3;

// ── Reading the stylesheet ──────────────────────────────────────────────────

const CSS = readFileSync(join(__dirname, '..', 'globals.css'), 'utf8');

/** The bodies of every rule whose selector list includes `selector`. */
function rulesFor(css: string, selector: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const bodies = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(',').some((s) => s.trim().replace(/\s+/g, ' ') === selector))
    .map((m) => m[2]);
  if (bodies.length === 0) throw new Error(`globals.css has no rule for ${selector}`);
  return bodies;
}

/**
 * The custom properties declared in every rule whose selector list includes
 * `selector`, by short name: `--lp-bg` as `bg`, `--pv-text` as `pv-text`.
 */
function declarations(css: string, selector: string): Tokens {
  const tokens: Tokens = {};
  for (const body of rulesFor(css, selector)) {
    for (const d of body.matchAll(/(--(?:lp|pv)-[\w-]+)\s*:\s*([^;]+);/g)) {
      tokens[d[1].replace(/^--(lp-)?/, '')] = d[2].trim().replace(/\s+/g, ' ');
    }
  }
  return tokens;
}

/**
 * The `color` a rule writes inline rather than through a token, read from the
 * stylesheet so a pair on it cannot drift either.
 */
function inlineColour(css: string, selector: string): string {
  const values = rulesFor(css, selector).flatMap((body) =>
    [...body.matchAll(/(?:^|[;\s])color\s*:\s*([^;]+);/g)].map((d) => d[1].trim())
  );
  if (values.length === 0) throw new Error(`${selector} sets no color`);
  return values[values.length - 1];
}

/** Both themes' tokens as the cascade resolves them on `.lp-root`. */
function themesFrom(css: string): Record<Theme, Tokens> {
  const light = declarations(css, '.lp-root');
  const dark = { ...light, ...declarations(css, "html[data-theme='dark'] .lp-root") };
  return { light, dark };
}

// ── Colour maths ────────────────────────────────────────────────────────────

/** A token's value as a colour, following `var()` and the `color-mix(…, transparent)` the nav uses. */
function resolve(tokens: Tokens, value: string, seen: string[] = []): Rgba {
  const v = value.trim();
  const ref = /^var\(--(?:lp-)?([\w-]+)\)$/.exec(v);
  if (ref) {
    const name = ref[1];
    if (seen.includes(name)) throw new Error(`--${name} refers to itself`);
    if (!(name in tokens)) throw new Error(`--${name} is not declared`);
    return resolve(tokens, tokens[name], [...seen, name]);
  }
  if (/^#[0-9a-f]{6}$/i.test(v)) {
    return { rgb: [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)) as Rgb, a: 1 };
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(v);
  if (rgba) {
    const [r, g, b, a = 1] = rgba[1].split(',').map((n) => Number(n.trim()));
    return { rgb: [r, g, b], a };
  }
  // Mixing with `transparent` in any space only scales alpha: transparent
  // carries no hue into a premultiplied mix.
  const mix = /^color-mix\(in \w+, (.+) (\d+(?:\.\d+)?)%, transparent\)$/.exec(v);
  if (mix) {
    const c = resolve(tokens, mix[1], seen);
    return { rgb: c.rgb, a: c.a * (Number(mix[2]) / 100) };
  }
  throw new Error(`cannot read colour "${v}"`);
}

/** `top` composited over an opaque `under`. */
function over(top: Rgba, under: Rgb): Rgb {
  return top.rgb.map((c, i) => c * top.a + under[i] * (1 - top.a)) as Rgb;
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ── The pairs (#82) ─────────────────────────────────────────────────────────

/**
 * One foreground on one ground. Each side is a token name, or `#rrggbb` for a
 * colour the stylesheet writes inline. A translucent ground is composited over
 * `under` (a token, or a colour): the preview's status chips sit on the panel,
 * the nav on whatever scrolls beneath it.
 */
type Pair = { what: string; fg: string; bg: string; under?: string; floor: number };

const BLACK = '#000000';
const WHITE = '#ffffff';

function pairs(theme: Theme, css: string = CSS): Pair[] {
  const list: Pair[] = [];
  for (const fg of ['text', 'muted', 'subtle']) {
    for (const bg of ['bg', 'band', 'surface']) {
      list.push({ what: `${fg} on ${bg}`, fg, bg, floor: TEXT });
    }
  }
  list.push(
    { what: 'primary button', fg: 'on-ink', bg: 'ink', floor: TEXT },
    { what: 'accent word on charcoal', fg: 'gold', bg: 'charcoal', floor: TEXT },
    { what: 'closing band text', fg: 'dark-text', bg: 'dark', floor: TEXT },
    { what: 'closing band muted', fg: 'dark-muted', bg: 'dark', floor: TEXT },
    { what: 'closing button', fg: 'charcoal', bg: 'cream', floor: TEXT },
    // The dark hero's fact labels and values; the light hero's are subtle and
    // text on bg, listed above and below.
    { what: 'dark hero fact labels', fg: 'sand-dim', bg: 'charcoal', floor: TEXT },
    { what: 'dark hero lede', fg: 'sand-muted', bg: 'charcoal', floor: TEXT },
    {
      what: 'dark hero headline',
      fg: inlineColour(css, '.lp-hero .lp-h1'),
      bg: 'charcoal',
      floor: LARGE_TEXT,
    },
    {
      what: 'dark hero fact values',
      fg: inlineColour(css, '.lp-hero-facts dd'),
      bg: 'charcoal',
      floor: LARGE_TEXT,
    },
    // The nav ground is translucent: check it over the darkest and lightest
    // thing that can scroll under it.
    ...[BLACK, WHITE].flatMap((under) =>
      theme === 'light'
        ? [
            { what: `nav text over ${under}`, fg: 'text', bg: 'nav-ground', under, floor: TEXT },
            { what: `nav links over ${under}`, fg: 'text', bg: 'nav-ground', under, floor: TEXT },
          ]
        : [
            { what: `nav text over ${under}`, fg: 'sand', bg: 'nav-ground', under, floor: TEXT },
            {
              what: `nav links over ${under}`,
              fg: inlineColour(css, '.lp-nav .lp-navlink'),
              bg: 'nav-ground',
              under,
              floor: TEXT,
            },
          ]
    ),
    // The booking-page preview and its result card.
    { what: 'preview text', fg: 'pv-text', bg: 'pv-panel', floor: TEXT },
    { what: 'preview muted on panel', fg: 'pv-muted', bg: 'pv-panel', floor: TEXT },
    { what: 'preview muted on page', fg: 'pv-muted', bg: 'pv-bg', floor: TEXT },
    { what: 'preview text on bar', fg: 'pv-text', bg: 'pv-bar', floor: TEXT },
    { what: 'preview button', fg: 'pv-on-text', bg: 'pv-text', floor: TEXT },
    ...['green', 'amber', 'blue', 'grey'].map((s) => ({
      what: `${s} status chip`,
      fg: `pv-${s}`,
      bg: `pv-${s}-bg`,
      under: 'pv-panel',
      floor: TEXT,
    })),
    // Focus ring: ink on paper and the light bands, light on charcoal.
    ...['bg', 'band', 'surface'].map((bg) => ({
      what: `focus ring on ${bg}`,
      fg: 'ink',
      bg,
      floor: FOCUS_RING,
    })),
    { what: 'focus ring on charcoal', fg: 'sand', bg: 'charcoal', floor: FOCUS_RING },
    { what: 'focus ring on the dark band', fg: 'sand', bg: 'dark', floor: FOCUS_RING }
  );
  if (theme === 'light') {
    list.push(
      // The light hero: the accent word and the large type on paper (the
      // wash keeps the ground at least 80% paper where the words sit).
      { what: 'accent word on paper', fg: 'accent-word', bg: 'bg', floor: TEXT },
      { what: 'accent word on band', fg: 'accent-word', bg: 'band', floor: TEXT },
      { what: 'light hero headline and fact values', fg: 'text', bg: 'bg', floor: LARGE_TEXT },
      {
        what: 'focus ring on the nav',
        fg: 'ink',
        bg: 'nav-ground',
        under: BLACK,
        floor: FOCUS_RING,
      }
    );
  } else {
    list.push(
      { what: 'accent word on the dark hero', fg: 'accent-word', bg: 'charcoal', floor: TEXT },
      {
        what: 'focus ring on the nav',
        fg: 'sand',
        bg: 'nav-ground',
        under: WHITE,
        floor: FOCUS_RING,
      }
    );
  }
  return list;
}

function colour(tokens: Tokens, side: string): Rgba {
  return resolve(tokens, side.startsWith('#') ? side : `var(--${side})`);
}

/** The pair's contrast ratio with the theme's tokens. */
function ratio(tokens: Tokens, pair: Pair): number {
  const ground = groundOf(tokens, pair);
  return contrast(over(colour(tokens, pair.fg), ground), ground);
}

/** The opaque colour the pair's foreground is read against. */
function groundOf(tokens: Tokens, pair: Pair): Rgb {
  const under = pair.under ? colour(tokens, pair.under) : undefined;
  if (under && under.a !== 1) throw new Error(`${pair.under} must be opaque`);
  const bgColour = colour(tokens, pair.bg);
  if (bgColour.a !== 1 && !under)
    throw new Error(`${pair.what}: ${pair.bg} is translucent; say what it sits on`);
  return under ? over(bgColour, under.rgb) : bgColour.rgb;
}

function hex(rgb: Rgb): string {
  return '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

/** The pairs below their floor, by name. */
function failures(tokens: Tokens, theme: Theme, css: string = CSS): string[] {
  return pairs(theme, css)
    .map((p) => ({ p, r: ratio(tokens, p) }))
    .filter(({ p, r }) => r < p.floor)
    .map(({ p, r }) => `${p.what} ${r.toFixed(2)}:1 < ${p.floor}:1`);
}

// ── Tests ───────────────────────────────────────────────────────────────────

const THEMES = themesFrom(CSS);

describe('landing palette tokens in globals.css', () => {
  it('holds palette 1 (#82) in both themes', () => {
    const pick = (t: Tokens, names: string[]) => Object.fromEntries(names.map((n) => [n, t[n]]));
    const names = [
      'bg',
      'band',
      'surface',
      'text',
      'muted',
      'subtle',
      'charcoal',
      'dark',
      'dark-text',
      'dark-muted',
      'gold',
      'accent-word',
      'nav-ground',
    ];
    expect(pick(THEMES.light, names)).toEqual({
      bg: '#faf8f5',
      band: '#f3efe9',
      surface: '#ffffff',
      text: '#1c1917',
      muted: '#57514b',
      subtle: '#6e6660',
      charcoal: '#1c1a17',
      dark: '#1c1a17',
      'dark-text': '#f6f1e9',
      'dark-muted': '#b3ab9f',
      gold: '#e2c08d',
      'accent-word': '#86652f',
      'nav-ground': 'color-mix(in oklab, var(--lp-bg) 90%, transparent)',
    });
    expect(pick(THEMES.dark, names)).toEqual({
      bg: '#0f0e0d',
      band: '#161412',
      surface: '#1c1a17',
      text: '#f3efe9',
      muted: '#bab2a7',
      subtle: '#958d83',
      charcoal: '#1c1a17',
      dark: '#1c1a17',
      'dark-text': '#f6f1e9',
      'dark-muted': '#b3ab9f',
      gold: '#e2c08d',
      'accent-word': 'var(--lp-gold)',
      'nav-ground': 'color-mix(in oklab, var(--lp-charcoal) 94%, transparent)',
    });
  });

  it('declares the preview set in both themes', () => {
    for (const t of [THEMES.light, THEMES.dark]) {
      for (const n of ['pv-bg', 'pv-panel', 'pv-bar', 'pv-text', 'pv-muted', 'pv-on-text']) {
        expect(t[n]).toBeDefined();
      }
    }
  });
});

describe.each(['light', 'dark'] as const)('%s theme contrast', (theme) => {
  it.each(pairs(theme).map((p) => [p.what, p] as const))('%s meets its floor', (_what, pair) => {
    expect(ratio(THEMES[theme], pair)).toBeGreaterThanOrEqual(pair.floor);
  });
});

describe('the checker', () => {
  it('matches the WCAG reference ratios', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrast([118, 118, 118], [255, 255, 255])).toBeCloseTo(4.54, 2);
    expect(ratio(THEMES.light, { what: '', fg: 'accent-word', bg: 'bg', floor: TEXT })).toBeCloseTo(
      5.06,
      2
    );
  });

  // Lowering any listed pair below its floor must fail CI. Proven per pair:
  // move the foreground to the ground's own colour (1:1) and the checker
  // names exactly that pair.
  describe.each(['light', 'dark'] as const)('%s', (theme) => {
    it.each(
      pairs(theme)
        .filter((p) => !p.fg.startsWith('#'))
        .map((p) => [p.what, p] as const)
    )('fails when %s drops to 1:1', (_what, pair) => {
      const lowered = {
        ...THEMES[theme],
        [pair.fg]: hex(groundOf(THEMES[theme], pair)),
      };
      expect(failures(THEMES[theme], theme)).toEqual([]);
      expect(failures(lowered, theme)).toEqual(
        expect.arrayContaining([expect.stringContaining(pair.what)])
      );
    });
  });

  it('fails a lowered stylesheet, not just a lowered token map', () => {
    const lowered = CSS.replace(/(\.lp-root \{[^}]*?--lp-subtle:\s*)#6e6660/, '$1#a8a29c');
    expect(lowered).not.toBe(CSS);
    expect(failures(themesFrom(lowered).light, 'light')).toEqual(
      expect.arrayContaining([expect.stringContaining('subtle on bg')])
    );
  });

  // The pairs on a colour a rule writes inline are skipped above (there is no
  // token to lower); lower the rule itself instead.
  it.each([
    ['.lp-nav .lp-navlink', 'nav links over'],
    ['.lp-hero .lp-h1', 'dark hero headline'],
    ['.lp-hero-facts dd', 'dark hero fact values'],
  ])('fails when the inline colour of %s drops to 1:1', (selector, what) => {
    const at = CSS.indexOf(`${selector} {`);
    expect(at).toBeGreaterThan(-1);
    const end = CSS.indexOf('}', at);
    const lowered =
      CSS.slice(0, at) +
      CSS.slice(at, end).replace(/(\n\s*color:\s*)#[0-9a-f]{6}/i, '$1#1c1a17') +
      CSS.slice(end);
    expect(lowered).not.toBe(CSS);
    expect(failures(THEMES.dark, 'dark', lowered)).toEqual(
      expect.arrayContaining([expect.stringContaining(what)])
    );
  });

  it('refuses a colour it cannot read rather than passing it', () => {
    expect(() =>
      ratio(
        { ...THEMES.light, muted: 'oklch(0.5 0 0)' },
        pairs('light').find((p) => p.what === 'muted on bg')!
      )
    ).toThrow(/cannot read/);
  });
});
