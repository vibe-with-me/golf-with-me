// Connections: three lists behind segments, each on its own ladder.
import { expect, test } from '@playwright/test';
import { signUpWithProfile } from './helpers.ts';

test('a failed list says so with a retry; the other lists still render', async ({ page }) => {
  await signUpWithProfile(page, `smoke-lists-${Date.now()}@rls.test`, 'Smoke Lists');

  await page.goto('/connections');
  const segments = page.getByRole('navigation', { name: 'Connections lists' });
  await expect(segments.getByRole('link', { name: 'Connections' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByText("No connections yet. Tap someone's tag to start.")).toBeVisible();
  // No pending requests: the link is plain "Requests", with no count in its name.
  await segments.getByRole('link', { name: 'Requests', exact: true }).click();
  await expect(page).toHaveURL(/\/connections\?tab=requests$/);
  await expect(segments.getByRole('link', { name: 'Requests', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByText('No requests right now.')).toBeVisible();

  // Break one list, then enter the page fresh.
  let failing = true;
  await page.route('**/rpc/app/blocks/list', (route) =>
    failing ? route.fulfill({ status: 500, body: '{}' }) : route.continue(),
  );
  await page.goto('/connections?tab=blocked');
  await expect(page.getByText("Couldn't load your block list.")).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();

  await segments.getByRole('link', { name: 'Connections' }).click();
  await expect(page.getByText("No connections yet. Tap someone's tag to start.")).toBeVisible();

  await segments.getByRole('link', { name: 'Blocked' }).click();
  await expect(page.getByText("Couldn't load your block list.")).toBeVisible();
  failing = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('No one is blocked.')).toBeVisible();
});
