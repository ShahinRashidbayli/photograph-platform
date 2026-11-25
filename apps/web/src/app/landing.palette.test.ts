import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Every text colour pair on the landing page meets WCAG 2.2 AA, in each theme
 * on its own.
 *
 * <p>jsdom does not apply the stylesheet, so no component test can measure a
 * rendered colour. This reads the `--lp-*` and `--pv-*` values for both themes
 * straight from `globals.css` — the values the browser paints — and checks the
 * pairs the page actually sets: body text on each ground, the buttons, the
 * accent word, the dark band, the hero's facts, and the product previews.
 * Changing a token so a pair drops below the floor fails here, not in an
 * audit after release.
 *
 * <p>The floors are WCAG's: 4.5:1 for text, 3:1 for large text (24px and up)
 * and for the focus ring against its ground. A translucent colour is laid
 * over the ground it sits on before measuring, as the browser would.
 */

const css = readFileSync(join(__dirname, 'globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The custom properties declared in the rule whose selector is exactly `selector`. */
function declarations(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`no rule for ${selector} in globals.css`);
  const body = css.slice(start, css.indexOf('\n}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
  );
}

const light = { ...declarations('.lp-root'), ...declarations('.lp-root,\n.lp-hero-band') };
const dark = { ...light, ...declarations("html[data-theme='dark'] .lp-root") };

type Rgba = { rgb: [number, number, number]; a: number };

function parse(value: string): Rgba {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 };
  }
  const rgba = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgba) {
    const [r, g, b, a = 1] = rgba[1].split(',').map(Number);
    return { rgb: [r, g, b], a };
  }
  throw new Error(`cannot measure "${value}": write landing colours as #rrggbb or rgba()`);
}

/** `fg` laid over an opaque `bg`. */
function over(fg: Rgba, bg: Rgba): Rgba {
  return { rgb: fg.rgb.map((v, i) => v * fg.a + bg.rgb[i] * (1 - fg.a)) as Rgba['rgb'], a: 1 };
}

function luminance({ rgb }: Rgba): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type Tokens = Record<string, string>;

/**
 * A token's value, following `var(--x)` to what it names. Pairs name the
 * `--lp-*` set without its prefix: `bg` is `--lp-bg`, `pv-text` is `--pv-text`.
 */
function value(tokens: Tokens, name: string): string {
  if (!/^(lp|pv)-/.test(name)) return value(tokens, `lp-${name}`);
  const v = tokens[name];
  if (v === undefined) throw new Error(`--${name} is not declared`);
  const ref = v.match(/^var\(--([\w-]+)\)$/);
  return ref ? value(tokens, ref[1]) : v;
}

const TEXT = 4.5;
const LARGE = 3;
const RING = 3;

/**
 * [foreground, ground, floor, where]. A translucent ground (a status chip's
 * tint) sits on `--pv-panel`, the card the chips are drawn on.
 */
type Pair = [string, string, number, string];

const PAIRS: Record<'light' | 'dark', Pair[]> = {
  light: [
    ['gold-paper', 'bg', TEXT, 'the accent word in the light hero'],
    ['gold-paper', 'band', TEXT, 'the accent word, should the hero end on the band'],
    ['subtle', 'bg', TEXT, 'the light hero’s fact labels'],
    ['text', 'bg', LARGE, 'the light hero’s fact values'],
  ],
  dark: [
    ['sand-dim', 'charcoal', TEXT, 'the dark hero’s fact labels'],
    ['sand-muted', 'charcoal', TEXT, 'the dark hero’s lede'],
    ['sand', 'charcoal', TEXT, 'the dark nav and the dark hero’s second button'],
    ['cream', 'charcoal', LARGE, 'the dark hero’s headline'],
  ],
};

const BOTH: Pair[] = [
  ...['bg', 'band', 'surface'].flatMap((ground): Pair[] => [
    ['text', ground, TEXT, 'body text'],
    ['muted', ground, TEXT, 'secondary text'],
    ['subtle', ground, TEXT, 'tertiary text'],
  ]),
  ['on-ink', 'ink', TEXT, 'the ink pill'],
  ['charcoal', 'cream', TEXT, 'the cream pill on charcoal'],
  ['gold', 'charcoal', TEXT, 'the accent word on charcoal'],
  ['dark-text', 'dark', TEXT, 'the closing band'],
  ['dark-muted', 'dark', TEXT, 'the closing band’s lede and footer links'],
  ['pv-text', 'pv-panel', TEXT, 'a preview'],
  ['pv-muted', 'pv-panel', TEXT, 'a preview'],
  ['pv-muted', 'pv-bg', TEXT, 'a preview'],
  ['pv-on-text', 'pv-text', TEXT, 'a preview’s filled button'],
  ...['green', 'amber', 'blue', 'grey'].map(
    (tone): Pair => [`pv-${tone}`, `pv-${tone}-bg`, TEXT, 'a status chip']
  ),
  ['ink', 'bg', RING, 'the focus ring on paper'],
  ['ink', 'band', RING, 'the focus ring on a band'],
  ['ink', 'surface', RING, 'the focus ring on a card'],
  ['sand', 'charcoal', RING, 'the focus ring on charcoal'],
];

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('the landing palette in %s mode', (theme, tokens) => {
  it.each([...BOTH, ...PAIRS[theme]])('%s on %s meets %s:1 (%s)', (fg, ground, floor) => {
    const panel = parse(value(tokens, 'pv-panel'));
    const g = parse(value(tokens, ground));
    const bg = g.a < 1 ? over(g, panel) : g;
    const ratio = contrast(over(parse(value(tokens, fg)), bg), bg);
    expect(ratio).toBeGreaterThanOrEqual(floor);
  });

  if (theme === 'light') {
    // The hero's paper wash is at least 0.8 wherever the words sit, so they
    // hold over the darkest a photograph can be, not just over the field.
    it.each([
      ['text', TEXT],
      ['muted', TEXT],
      ['gold-paper', LARGE],
    ] as const)('keeps %s readable over the hero wash at its thinnest', (fg, floor) => {
      const wash = over({ ...parse(value(tokens, 'bg')), a: 0.8 }, parse('#000000'));
      expect(contrast(parse(value(tokens, fg)), wash)).toBeGreaterThanOrEqual(floor);
    });

    // The light nav is paper at 90% over whatever scrolls under it; the darkest
    // thing that can is the closing band.
    it('keeps the nav’s ink readable over the closing band', () => {
      const bar = over({ ...parse(value(tokens, 'bg')), a: 0.9 }, parse(value(tokens, 'charcoal')));
      expect(contrast(parse(value(tokens, 'text')), bar)).toBeGreaterThanOrEqual(TEXT);
    });
  }
});

describe('reading the palette', () => {
  it('finds the themes apart', () => {
    expect(value(light, 'bg')).toBe('#faf8f5');
    expect(value(dark, 'bg')).toBe('#0f0e0d');
    expect(value(dark, 'pv-panel')).not.toBe(value(light, 'pv-panel'));
  });

  it('measures a known pair as WCAG does', () => {
    expect(contrast(parse('#000000'), parse('#ffffff'))).toBeCloseTo(21, 5);
    expect(contrast(parse('#86652f'), parse('#faf8f5'))).toBeCloseTo(5.06, 2);
  });
});
