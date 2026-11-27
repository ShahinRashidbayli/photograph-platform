import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * `next build` downloads every `next/font/google` face, and Google does not
 * always answer with `/s/<family>/<version>/<hash>.woff2` URLs. From GitHub's
 * runners about one CSS response in thirty lists extensionless
 * `/l/font?kit=…` URLs instead (still WOFF2, per the `format()` hint and the
 * file's own magic bytes). next 15.5 read the extension off the URL, so the
 * CI Build job died with "Cannot read properties of null (reading '1')" on
 * whichever run drew such a response.
 *
 * next 16 reads the format from the CSS instead (until then a patch-package
 * backport did). This replays a response captured on a runner through the
 * real loader, so it fails if a next upgrade brings the crash back.
 */
const CSS_URL = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap';

const CAPTURED_CSS = `/* latin */
@font-face {
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/l/font?kit=tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYaTNPxDcwgknk-4&skey=48ad01c60053c2ae&v=v24) format('woff2');
  unicode-range: U+0000-00FF;
}
`;

/**
 * Runs the loader in a plain Node process, the way `next build` does. Not
 * imported into the test: next/jest maps every module path containing
 * `@next/font/` to a stub (Jest's `createRequire` included), and a test
 * against the stub passes or fails for reasons unrelated to the loader.
 */
const LOADER_RUN = `
const loader = require('next/dist/compiled/@next/font/dist/google/loader').default;
const emitted = [];
loader({
  functionName: 'JetBrains_Mono',
  variableName: 'lpMono',
  data: [{ subsets: ['latin'], weight: ['400', '500'], display: 'swap' }],
  emitFontFile: (_content, ext) => {
    emitted.push(ext);
    return '/_next/static/media/font.' + ext;
  },
  resolve: (src) => src,
  // In dev the loader swallows the error and serves a fallback face; only
  // \`next build\` throws, which is why this never showed up locally.
  isDev: false,
  isServer: true,
  loaderContext: undefined,
}).then((result) => process.stdout.write(JSON.stringify({ emitted, css: result.css })));
`;

function loadReplayedFont(): { emitted: string[]; css: string } {
  const responses = join(mkdtempSync(join(tmpdir(), 'next-font-')), 'responses.json');
  writeFileSync(responses, JSON.stringify({ [CSS_URL]: CAPTURED_CSS }));
  const stdout = execFileSync(process.execPath, ['-e', LOADER_RUN], {
    cwd: __dirname,
    encoding: 'utf8',
    // next/font's own replay hook: the CSS comes from this file, and each font
    // file "downloads" as its URL's bytes, so nothing reaches the network.
    env: { ...process.env, NEXT_FONT_GOOGLE_MOCKED_RESPONSES: responses },
  });
  return JSON.parse(stdout) as { emitted: string[]; css: string };
}

describe('next/font/google at build time', () => {
  it('self-hosts an extensionless Google font URL as woff2 instead of failing the build', () => {
    const { emitted, css } = loadReplayedFont();

    expect(emitted).toEqual(['woff2']);
    expect(css).toContain('url(/_next/static/media/font.woff2)');
    expect(css).not.toContain('fonts.gstatic.com');
  });
});
