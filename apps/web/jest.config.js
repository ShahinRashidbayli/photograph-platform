const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // A production build writes a second copy of package.json under
  // .next/standalone, which jest's module map then reports as a name
  // collision on every run. Nothing in there is ours to test.
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  // Reported for the code these tests are meant to protect. Not enforced as a
  // threshold: a number that has to be met invites tests written to move it,
  // which is the opposite of why this suite exists.
  collectCoverageFrom: ['src/components/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}'],
};

module.exports = createJestConfig(config);
