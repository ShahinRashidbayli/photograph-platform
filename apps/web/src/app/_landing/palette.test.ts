import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Every text pair on the landing page meets WCAG 2.2 AA, in each theme on its
 * own, measured from the values `globals.css` actually ships.
 *
 * The palette used to be audited with a script fed a hand-copied JSON of the
 * tokens, which drifts the first time someone nudges a hex in the stylesheet.
 * This reads the `--lp-*` and `--pv-*` declarations straight out of
 * `globals.css`, so lowering a value below its floor fails CI.
 *
 * Floors: text 4.5:1, the focus ring 3:1 against its ground. The large-text
 * floor (3:1 from 24 px) is not used: the accent word and the hero figures
 * pass 4.5:1 today, and the accent ink is meant for smaller sizes too.
 */
const CSS = readFileSync(path.join(__dirname, '..', 'globals.css'), 'utf8');

const TEXT = 4.5;
const FOCUS_RING = 3;

type Rgba = { r: number; g: number; b: number; a: number };
type Tokens = Record<string, string>;

/** The custom properties declared in the rule whose selector is exactly `selector`. */
function declarations(selector: string): Tokens {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
  const block = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(CSS);
  if (!block) throw new Error(`globals.css has no rule for ${selector}`);
  const tokens: Tokens = {};
  for (const [, name, value] of block[1].matchAll(/--((?:lp|pv)-[\w-]+):\s*([^;]+);/g)) {
    tokens[name] = value.trim();
  }
  return tokens;
}

/* The cascade the page sees: the dark theme only overrides what changes, so
   the charcoal room and the dark band are declared once, on `.lp-root`. The
   hero re-declares the light `--pv-*` set in both themes, so the light
   previews are also what the hero shows in dark. */
const light: Tokens = { ...declarations('.lp-root'), ...declarations('.lp-root, .lp-hero-band') };
const dark: Tokens = { ...light, ...declarations("html[data-theme='dark'] .lp-root") };
const THEMES = { light, dark } as const;

function parseColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(
    value
  );
  if (rgba) {
    const [r, g, b] = rgba.slice(1, 4).map(Number);
    return { r, g, b, a: rgba[4] === undefined ? 1 : Number(rgba[4]) };
  }
  throw new Error(`Cannot measure ${value}: only #rrggbb and rgb()/rgba() are supported`);
}

/** A translucent colour as it shows over an opaque one. */
function over(top: Rgba, under: Rgba): Rgba {
  const mix = (t: number, u: number) => t * top.a + u * (1 - top.a);
  return { r: mix(top.r, under.r), g: mix(top.g, under.g), b: mix(top.b, under.b), a: 1 };
}

function luminance({ r, g, b }: Rgba): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type Pair = {
  what: string;
  fg: string;
  bg: string;
  /** Opaque token a translucent `bg` sits on (the dark theme's chips sit on the panel). */
  under?: string;
  floor: number;
};

/** The ratio of `pair` in `tokens`, without rounding: 4.499 is a fail. */
function ratio(pair: Pair, tokens: Tokens): number {
  const token = (name: string) => {
    const value = tokens[name];
    if (value === undefined) throw new Error(`--${name} is not declared`);
    return parseColor(value);
  };
  let ground = token(pair.bg);
  if (ground.a < 1) {
    if (!pair.under) throw new Error(`--${pair.bg} is translucent; say what it sits on`);
    ground = over(ground, token(pair.under));
  }
  const fg = token(pair.fg);
  return contrast(fg.a < 1 ? over(fg, ground) : fg, ground);
}

const text = (what: string, fg: string, bg: string, under?: string): Pair => ({
  what,
  fg,
  bg,
  under,
  floor: TEXT,
});
const ring = (what: string, bg: string, fg: string): Pair => ({ what, fg, bg, floor: FOCUS_RING });

const GROUNDS = ['lp-bg', 'lp-band', 'lp-surface'];
const CHIPS = ['green', 'amber', 'blue', 'grey'];

const PAIRS: Pair[] = [
  ...GROUNDS.flatMap((bg) =>
    ['lp-text', 'lp-muted', 'lp-subtle'].map((fg) => text(`${fg} on ${bg}`, fg, bg))
  ),
  text('primary button: on-ink on ink', 'lp-on-ink', 'lp-ink'),
  text('accent word on paper', 'lp-accent-ink', 'lp-bg'),
  text('accent word on a light band', 'lp-accent-ink', 'lp-band'),
  text('accent word in the charcoal hero', 'lp-gold', 'lp-charcoal'),
  text('dark band text', 'lp-dark-text', 'lp-dark'),
  text('dark band muted text', 'lp-dark-muted', 'lp-dark'),
  text('hero fact labels', 'lp-sand-dim', 'lp-charcoal'),
  ...['pv-bg', 'pv-panel', 'pv-bar'].flatMap((bg) =>
    ['pv-text', 'pv-muted'].map((fg) => text(`preview ${fg} on ${bg}`, fg, bg))
  ),
  ...CHIPS.map((chip) => text(`${chip} status chip`, `pv-${chip}`, `pv-${chip}-bg`, 'pv-panel')),
  text('solid chip', 'pv-on-text', 'pv-text'),
  ...GROUNDS.map((bg) => ring(`focus ring on ${bg}`, bg, 'lp-ink')),
  ring('focus ring on charcoal (nav, hero, dark band)', 'lp-charcoal', 'lp-sand'),
  ring('focus ring on the dark band', 'lp-dark', 'lp-sand'),
];

describe.each(Object.entries(THEMES))('landing palette, %s theme', (_theme, tokens) => {
  it.each(PAIRS.map((pair) => [pair.what, pair] as const))('%s meets its floor', (_what, pair) => {
    expect(ratio(pair, tokens)).toBeGreaterThanOrEqual(pair.floor);
  });
});

describe('the palette test itself', () => {
  it('reads both themes from globals.css', () => {
    expect(light['lp-bg']).toBe('#faf8f5');
    expect(dark['lp-bg']).toBe('#0f0e0d');
    // Declared once on .lp-root, so dark inherits it.
    expect(dark['lp-charcoal']).toBe('#1c1a17');
    expect(light['lp-accent-ink']).toBe('#86652f');
    expect(dark['lp-accent-ink']).toBe('#e2c08d');
    expect(light['lp-nav-ground']).toBe('rgba(250, 248, 245, 0.9)');
  });

  it('matches the published WCAG ratios', () => {
    expect(contrast(parseColor('#000000'), parseColor('#ffffff'))).toBeCloseTo(21, 5);
    expect(contrast(parseColor('#86652f'), parseColor('#faf8f5'))).toBeCloseTo(5.06, 2);
  });

  it('blends a translucent ground over what it sits on', () => {
    const half = over(parseColor('rgba(255, 255, 255, 0.5)'), parseColor('#000000'));
    expect(half).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
  });

  /* Lowering any pair below its floor has to fail the suite: feed the checker
     today's palette with one value pulled down. */
  it.each([
    ['muted text lightened', { 'lp-muted': '#8a837c' }, 'lp-muted on lp-band'],
    ['accent word lightened', { 'lp-accent-ink': '#a6854f' }, 'accent word on paper'],
    ['chip ink faded', { 'pv-amber': '#b88a40' }, 'amber status chip'],
    ['focus ring washed out', { 'lp-ink': '#d6d0c8' }, 'focus ring on lp-bg'],
  ])('fails when the %s', (_change, override, what) => {
    const pair = PAIRS.find((p) => p.what === what);
    if (!pair) throw new Error(`no pair named ${what}`);
    expect(ratio(pair, light)).toBeGreaterThanOrEqual(pair.floor);
    expect(ratio(pair, { ...light, ...override })).toBeLessThan(pair.floor);
  });

  it('refuses a translucent ground with nothing under it', () => {
    expect(() => ratio(text('x', 'pv-green', 'pv-green-bg'), dark)).toThrow(/translucent/);
  });
});
