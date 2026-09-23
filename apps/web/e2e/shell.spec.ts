// The shell: the signed-in chrome every tab lives in.
import { expect, test } from '@playwright/test';
import { returnToOf, signUp } from './helpers.ts';

test('a signed-out visitor is sent to sign in, then lands in the shell', async ({ page }) => {
  await page.goto('/connections');
  await page.waitForURL(/\/login\?/);
  expect(returnToOf(page)).toBe('/connections');

  await signUp(page, `smoke-shell-${Date.now()}@rls.test`);

  // No profile yet: the shell routes to Profile first and remembers the destination.
  await page.waitForURL(/\/profile\?/);
  expect(returnToOf(page)).toBe('/connections');

  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Connections' })).toBeVisible();
  // VITE_STORE_URL is unset for the smoke: the Merch tab must not exist.
  await expect(nav.getByRole('link', { name: 'Merch' })).toHaveCount(0);

  await page.getByLabel('Name').fill('Smoke Shell');
  await page.getByRole('button', { name: 'Save' }).click();

  await page.waitForURL('**/connections');
  await expect(nav.getByRole('link', { name: 'Connections' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Connections', exact: true })).toBeVisible();
});

test('the nav becomes a bottom bar at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/connections');
  await page.waitForURL(/\/login\?/);
  await signUp(page, `smoke-shell-narrow-${Date.now()}@rls.test`);
  await page.waitForURL(/\/profile\?/);

  const nav = page.getByRole('navigation', { name: 'Primary' });
  const box = await nav.boundingBox();
  expect(box).not.toBeNull();
  // Fixed to the bottom edge of the viewport.
  expect(Math.round(box!.y + box!.height)).toBe(844);
});

test('/me still lands on the profile', async ({ page }) => {
  await page.goto('/me');
  await page.waitForURL(/\/login\?/);
  expect(returnToOf(page)).toBe('/profile');
});
