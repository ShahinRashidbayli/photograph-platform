import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Guards against locale-dependent formatting that has no explicit locale.
 *
 * `date.toLocaleDateString(undefined, …)` — or with no arguments at all —
 * means "use whatever locale this runtime happens to default to". In a
 * server-rendered app the two runtimes are not the same machine: Node renders
 * the page as `en-US` while the visitor's browser renders it as, say, `tr-TR`.
 * React sees "November 20, 2026" where the server sent it and "20 Kasım 2026"
 * on the client, and throws the whole server tree away to re-render.
 *
 * This is a source scan rather than a rendering test on purpose. A test that
 * renders a component and asserts the date string only fails when the suite
 * itself runs under a mismatched locale — in CI, always `en-US`, so the bug
 * ships green. The pattern is what is wrong, and the pattern is what is
 * checked.
 *
 * The fix is always the same: use `format.*` from `useTranslation()`
 * (`lib/i18n/format.ts`), which is pinned to an explicit BCP-47 tag and holds
 * the source locale until after mount so both sides of hydration agree.
 */
const SRC = path.join(__dirname, '..', '..');

const FORBIDDEN = [
  /\.toLocaleDateString\(\s*(undefined\s*[,)]|\))/,
  /\.toLocaleTimeString\(\s*(undefined\s*[,)]|\))/,
  /\.toLocaleString\(\s*(undefined\s*[,)]|\))/,
  /\bIntl\.DateTimeFormat\(\s*(undefined\s*[,)]|\))/,
  /\bIntl\.NumberFormat\(\s*(undefined\s*[,)]|\))/,
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(full)) return [];
    if (full.endsWith('implicit-locale.test.ts')) return [];
    return [full];
  });
}

describe('locale-dependent formatting', () => {
  it('never relies on the runtime default locale', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (FORBIDDEN.some((re) => re.test(line))) {
          offenders.push(`${path.relative(SRC, file)}:${i + 1}  ${line.trim()}`);
        }
      });
    }

    // Reported as a joined string rather than an array so a failure prints the
    // offending file:line and the fix, instead of a diff of quoted paths.
    expect(
      offenders.length === 0
        ? ''
        : 'Implicit-locale formatting causes SSR hydration mismatches. ' +
            'Use format.* from useTranslation() instead:\n' +
            offenders.join('\n')
    ).toBe('');
  });
});
