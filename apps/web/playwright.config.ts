import { defineConfig } from '@playwright/test';

/**
 * Browser smoke tests (ADR-0001; production checklist item 9).
 * These run against a LIVE deployment/preview — set E2E_BASE_URL (and the
 * E2E_EMAIL / E2E_PASSWORD of a seeded test user). Without it every spec
 * skips, so CI stays green until a deployed target exists.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: 'on-first-retry',
  },
});
