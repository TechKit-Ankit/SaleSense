import nextJest from 'next/jest.js';

// next/jest handles the SWC transform, CSS modules, and env for us.
const createJestConfig = nextJest({ dir: './' });

const config = {
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Unit tests only — Playwright owns e2e/ (see playwright.config.ts).
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/e2e/'],
};

export default createJestConfig(config);
