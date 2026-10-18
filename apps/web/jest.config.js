const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  // jsdom with Node's Fetch API globals — see jest.jsdom-env.js.
  testEnvironment: '<rootDir>/jest.jsdom-env.js',
  /**
   * MSW v2 ships separate builds and picks between them with package export
   * conditions. jsdom resolves as a browser, where msw deliberately exports
   * `null` for `msw/node` — the interceptor these tests need. Asking for the
   * `node` condition selects its CommonJS build, which is what Jest can
   * require; the empty condition list msw's older docs suggest lands on the
   * ESM build instead and fails with "Cannot use import statement outside a
   * module".
   */
  testEnvironmentOptions: { customExportConditions: ['node'] },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // A production build writes a second copy of package.json under
  // .next/standalone, which jest's module map then reports as a name
  // collision on every run. Nothing in there is ours to test.
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  // e2e/ is Playwright's (`npm run e2e`); its specs import @playwright/test,
  // which refuses to load inside Jest.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/'],
  /**
   * Transform the few ESM-only packages msw pulls in.
   *
   * msw itself ships CommonJS, but some of its dependencies are ESM only —
   * `rettime` is `"type": "module"` with no CJS build — and Jest does not
   * transform node_modules by default, so requiring one fails with "Cannot use
   * import statement outside a module" from a file the stack trace attributes
   * to msw's TypeScript source, which is a confusing place to start looking.
   * Listed by name rather than opening node_modules wholesale: transforming
   * everything is slow, and a package that newly needs to be here is worth
   * noticing.
   */
  transformIgnorePatterns: [
    '/node_modules/(?!(msw|@mswjs|@bundled-es-modules|rettime|until-async|strict-event-emitter|is-node-process|headers-polyfill|@open-draft)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  // Reported for the code these tests are meant to protect. Not enforced as a
  // threshold: a number that has to be met invites tests written to move it,
  // which is the opposite of why this suite exists.
  collectCoverageFrom: ['src/components/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}'],
};

/**
 * next/jest builds the final config, and it sets `transformIgnorePatterns`
 * itself — its `/node_modules/` entry comes first and matches everything, so
 * the negative lookahead above never gets a chance. Post-processing the merged
 * config is next's documented escape hatch for exactly this.
 */
module.exports = async () => {
  const merged = await createJestConfig(config)();
  merged.transformIgnorePatterns = config.transformIgnorePatterns;
  return merged;
};
