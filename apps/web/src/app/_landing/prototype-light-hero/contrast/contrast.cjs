// Contrast audit for the landing palette. Usage: node contrast.cjs [palette.json]
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const parse = (c) => c.startsWith('#') ? { rgb: hex(c), a: 1 } : (() => { const m = c.match(/[\d.]+/g).map(Number); return { rgb: m.slice(0, 3), a: m[3] ?? 1 }; })();
const over = (fg, bg) => { const f = parse(fg), b = parse(bg); return '#' + f.rgb.map((v, i) => Math.round(v * f.a + b.rgb[i] * (1 - f.a)).toString(16).padStart(2, '0')).join(''); };
const L = (h) => { const c = hex(h).map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const P = require(process.argv[2]);
for (const theme of ['light', 'dark']) {
  const t = { ...P.shared, ...P[theme] };
  const rows = [];
  const pair = (fg, bg, min, note) => { const g = t[bg]; const f = t[fg].includes('rgba') ? over(t[fg], g) : t[fg]; const gg = g.includes('rgba') ? over(g, t[P.panelFor?.[bg] || 'pv-panel']) : g; const r = cr(f, gg); rows.push([`${fg} on ${bg}`, r.toFixed(2), min, r >= min ? 'ok' : 'FAIL', note || '']); };
  for (const g of ['bg', 'band', 'surface']) { pair('text', g, 4.5); pair('muted', g, 4.5); pair('subtle', g, 4.5); }
  pair('on-ink', 'ink', 4.5, 'primary button');
  if (theme === 'light') pair('gold-light', 'bg', 4.5, 'accent word on paper'), pair('gold-light', 'band', 4.5);
  pair('gold', 'charcoal', 4.5, 'accent word, dark hero');
  for (const g of ['dark']) { pair('dark-text', g, 4.5, 'closing band'); pair('dark-muted', g, 4.5, 'closing band'); }
  pair('sand-dim', 'charcoal', 4.5, 'hero facts labels (dark hero)');
  pair('pv-text', 'pv-panel', 4.5); pair('pv-muted', 'pv-panel', 4.5, 'preview'); pair('pv-muted', 'pv-bg', 4.5, 'preview');
  for (const s of ['green', 'amber', 'blue']) pair(`pv-${s}`, `pv-${s}-bg`, 4.5, 'status chip');
  const step = (a, b) => rows.push([`step ${a} → ${b}`, cr(t[a], t[b]).toFixed(3), '-', '', 'section separation (no AA rule)']);
  step('bg', 'band'); step('band', 'dark'); step('bg', 'dark');
  console.log(`\n${P.name} — ${theme}`); for (const r of rows) console.log(r[0].padEnd(28), r[1].padStart(6), String(r[2]).padStart(4), r[3].padEnd(4), r[4]);
}
