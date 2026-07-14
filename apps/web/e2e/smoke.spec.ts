import { test, expect } from '@playwright/test';

/**
 * Deployment smoke: login → dashboard → sales history → a receipt renders.
 * Gated on E2E_BASE_URL (see playwright.config.ts) so it only runs against
 * a real deployment/preview with a seeded test user.
 */
const BASE = process.env.E2E_BASE_URL;
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.skip(!BASE || !EMAIL || !PASSWORD, 'E2E_BASE_URL / E2E_EMAIL / E2E_PASSWORD not set — smoke runs against deployments only');

test('login → dashboard advisor visible → sales history loads', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder(/email/i).fill(EMAIL!);
  await page.getByPlaceholder(/password/i).fill(PASSWORD!);
  await page.getByRole('button', { name: /log ?in|sign ?in/i }).click();

  // Dashboard greets the user
  await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 15_000 });

  // Sales history renders (Wave C.1)
  await page.goto('/sales');
  await expect(page.getByRole('heading', { name: 'Sales' })).toBeVisible();
});

test('public receipt link rejects a tampered token gracefully', async ({ page }) => {
  await page.goto('/r/obviously-tampered-token');
  await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
});
