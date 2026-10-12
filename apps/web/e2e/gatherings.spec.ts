// The gathering: tap the host's tag, join, and see each other.
import { expect, test } from '@playwright/test';
import { admin, freshUid, signUp } from './helpers.ts';

test("tap a host's tag, join the gathering, and both see the member list", async ({ browser }) => {
  const uid = freshUid();
  const stamp = Date.now();
  const { error } = await admin.from('tags').insert({ uid });
  expect(error).toBeNull();

  // --- Ada: sign up with no destination -> Events is the default --------------
  const ada = await (await browser.newContext()).newPage();
  await ada.goto('/login');
  await signUp(ada, `smoke-host-${stamp}@rls.test`);
  await ada.waitForURL(/\/profile\?/);
  await ada.getByLabel('Name').fill('Smoke Ada');
  await ada.getByRole('button', { name: 'Save' }).click();
  await ada.waitForURL('**/gatherings');
  const adaNav = ada.getByRole('navigation', { name: 'Primary' });
  await expect(adaNav.getByRole('link', { name: 'Events' })).toHaveAttribute('aria-current', 'page');

  // --- Ada claims a tag (signed in: tap -> claim flow) --------------------------
  await ada.goto(`/t/${uid}`);
  await ada.waitForURL(`**/claim/${uid}`);
  await ada.getByRole('button', { name: 'Claim tag' }).click();
  await ada.waitForURL(`**/t/${uid}`);
  await expect(ada.getByText('This is your tag.')).toBeVisible();

  // --- Ada creates a gathering and points her tag at it -------------------------
  await ada.goto('/gatherings');
  await ada.getByLabel('Title').fill('Smoke Rooftop');
  await ada.getByLabel('Location (optional)').fill('The roof');
  await ada.getByRole('button', { name: 'Create gathering' }).click();
  await expect(ada.getByText('Smoke Rooftop')).toBeVisible();
  await ada.getByRole('link', { name: 'Open' }).click();
  await ada.waitForURL(/\/gatherings\/[0-9a-f-]{36}$/);
  const detailPath = new URL(ada.url()).pathname;
  await expect(ada.getByRole('heading', { name: 'Smoke Rooftop' })).toBeVisible();
  await expect(ada.getByText('Host', { exact: true })).toBeVisible();
  await ada.getByRole('button', { name: 'Point my tags at this gathering' }).click();
  await expect(ada.getByRole('button', { name: 'Point my tags back to my profile' })).toBeVisible();

  // --- Bob: taps anonymously, sees the invitation, signs up, joins -------------
  const bob = await (await browser.newContext()).newPage();
  await bob.goto(`/t/${uid}`);
  await expect(bob.getByRole('heading', { name: 'Smoke Ada' })).toBeVisible();
  await expect(bob.getByText(/Smoke Rooftop/)).toBeVisible();
  await bob.getByRole('link', { name: 'Join this gathering' }).click(); // shell guard -> login
  await bob.waitForURL(/\/login\?/);
  await signUp(bob, `smoke-guest-${stamp}@rls.test`);
  await bob.waitForURL(/\/profile\?/); // no profile yet: name first, destination remembered
  await bob.getByLabel('Name').fill('Smoke Bob');
  await bob.getByRole('button', { name: 'Save' }).click();

  await bob.waitForURL(`**${detailPath}**`);
  await expect(bob.getByRole('heading', { name: 'Join this gathering?' })).toBeVisible();
  await expect(bob.getByText(/Smoke Rooftop/)).toBeVisible(); // the hint, before joining
  await bob.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(bob.getByRole('heading', { name: 'Smoke Rooftop' })).toBeVisible();
  await expect(bob.getByText('Smoke Ada')).toBeVisible();
  await expect(bob.getByText('Smoke Bob')).toBeVisible();
  await expect(bob.getByRole('button', { name: 'Leave gathering' })).toBeVisible();

  // Tapping the tag again as a member opens the gathering instead of inviting twice.
  await bob.goto(`/t/${uid}`);
  await expect(bob.getByRole('link', { name: 'Open gathering' })).toBeVisible();

  // --- Ada sees Bob too ----------------------------------------------------------
  await ada.reload();
  await expect(ada.getByText('Smoke Bob')).toBeVisible();
});
