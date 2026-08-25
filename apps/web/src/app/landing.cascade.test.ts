import fs from 'fs';
import path from 'path';

/**
 * The scroll-reveal cascade, checked against the stylesheet itself.
 *
 * <p>This exists because the reveal has a failure mode that every other check
 * in the repo is blind to: `tsc`, ESLint, `next build` and the DOM-level tests
 * all pass while the entire page below the hero renders at `opacity: 0`. The
 * markup is correct, the class is added, the rule is present — it simply loses
 * the cascade. Nothing that reads the DOM can see that, because jsdom does not
 * apply stylesheets.
 *
 * <p>It has gone wrong twice, both times by making the gate *more* specific:
 * `.landing-js .landing-reveal` (0,2,0) and then `html[data-js]
 * .landing-reveal` (0,2,1), against a `.landing-reveal.in` scoring (0,2,0).
 * An attribute selector weighs the same as a class, so it is the element name
 * that tips it — which is exactly the sort of detail a reviewer waves through.
 *
 * <p>So the assertions are about specificity arithmetic, not about text: change
 * the selectors however you like, as long as the reveal still wins.
 */

const css = fs
  .readFileSync(path.join(__dirname, 'globals.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Top-level rules, with `@media` blocks lifted out and kept separately. */
const mediaBlocks: { query: string; body: string }[] = [];
const baseCss = css.replace(/@media([^{]+)\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_m, query, body) => {
  mediaBlocks.push({ query: String(query).trim(), body: String(body) });
  return '';
});

type Spec = [number, number, number];

/**
 * CSS specificity as (ids, classes, elements).
 *
 * <p>Attribute selectors and pseudo-classes count in the class column — the
 * point the bug turned on.
 */
function specificity(selector: string): Spec {
  const s = selector.trim();
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes =
    (s.match(/\.[\w-]+/g) || []).length +
    (s.match(/\[[^\]]+\]/g) || []).length +
    (s.match(/:(?!:)[\w-]+/g) || []).length;
  const elements = (s.replace(/\[[^\]]+\]/g, '').match(/(^|[\s>+~])([a-z][\w-]*)/gi) || []).length;
  return [ids, classes, elements];
}

const compare = (a: Spec, b: Spec) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

type Rule = { selector: string; body: string };

/** Rules declaring `prop`, whose selector matches, in source order. */
function rulesFor(source: string, prop: string, selector: RegExp): Rule[] {
  return [...source.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .flatMap((m) => m[1].split(',').map((sel) => ({ selector: sel.trim(), body: m[2] })))
    .filter((r) => new RegExp(`(^|[;\\s])${prop}\\s*:`).test(r.body))
    .filter((r) => selector.test(r.selector));
}

/** The declaration that wins: highest specificity, last one on a tie. */
function resolve(rules: Rule[], prop: string) {
  let winner: { selector: string; value: string; spec: Spec } | null = null;
  for (const r of rules) {
    const spec = specificity(r.selector);
    const value = r.body.match(new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+)`))![1].trim();
    if (!winner || compare(spec, winner.spec) >= 0) winner = { selector: r.selector, value, spec };
  }
  return winner;
}

const REVEAL = /^\S*\s*\.landing-reveal(\.in)?$/;
const STAGGER = /^\S*\s*\.landing-reveal-stagger(\.in)? > \*$/;

const reducedMotion = () => {
  const block = mediaBlocks.find((m) => /prefers-reduced-motion/.test(m.query));
  if (!block) throw new Error('no prefers-reduced-motion block');
  return block.body;
};

describe('scroll-reveal cascade', () => {
  it('reveals a block once the observer adds .in', () => {
    const winner = resolve(rulesFor(baseCss, 'opacity', REVEAL), 'opacity');
    expect(winner).not.toBeNull();
    // The whole point: if this is "0", the page is invisible in a browser and
    // passes every other test in the suite.
    expect(winner!.value).toBe('1');
  });

  it('hides a block that has not been revealed yet', () => {
    const notIn = rulesFor(baseCss, 'opacity', /^\S*\s*\.landing-reveal$/);
    expect(resolve(notIn, 'opacity')!.value).toBe('0');
  });

  it('animates staggered children once their container is .in', () => {
    const winner = resolve(rulesFor(baseCss, 'animation', STAGGER), 'animation');
    expect(winner!.value).toContain('landing-fade-in');
  });

  it('keeps the reveal gated on data-js, so a no-JS render stays visible', () => {
    const gates = rulesFor(baseCss, 'opacity', /\.landing-reveal/);
    expect(gates.length).toBeGreaterThan(0);
    // Every rule that can hide something must be behind the flag; one that is
    // not would hide that block for a visitor whose bundle never ran.
    for (const rule of gates) {
      if (/opacity\s*:\s*0/.test(rule.body)) {
        expect(rule.selector).toMatch(/\[data-js\]/);
      }
    }
  });

  it('stops the animation for prefers-reduced-motion, .in included', () => {
    const rules = [
      ...rulesFor(baseCss, 'animation', STAGGER),
      ...rulesFor(reducedMotion(), 'animation', STAGGER),
    ];
    // A media query adds no specificity, so the override has to match or beat
    // the `.in` rule rather than merely follow it.
    expect(resolve(rules, 'animation')!.value).toBe('none');
  });

  it('still shows the content for prefers-reduced-motion', () => {
    const rules = [
      ...rulesFor(baseCss, 'opacity', REVEAL),
      ...rulesFor(reducedMotion(), 'opacity', REVEAL),
    ];
    expect(resolve(rules, 'opacity')!.value).toBe('1');
  });
});

describe('specificity helper', () => {
  // Pins the arithmetic the assertions above depend on, including the exact
  // comparison both regressions got wrong.
  it('counts an attribute selector as a class, and an element as an element', () => {
    expect(specificity('[data-js] .landing-reveal')).toEqual([0, 2, 0]);
    expect(specificity('html[data-js] .landing-reveal')).toEqual([0, 2, 1]);
    expect(specificity('.landing-reveal.in')).toEqual([0, 2, 0]);
  });

  it('ranks the historical broken gate above the rule it was meant to lose to', () => {
    expect(
      compare(specificity('html[data-js] .landing-reveal'), specificity('.landing-reveal.in'))
    ).toBeGreaterThan(0);
  });
});
