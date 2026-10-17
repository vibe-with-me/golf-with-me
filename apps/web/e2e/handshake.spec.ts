// The one smoke test: resolve -> claim -> connect, through real browsers.
// Two strangers tap the same tag and end up connected.
import { expect, test } from '@playwright/test';
import { admin, agreeToTerms, freshUid, signUp } from './helpers.ts';

test('two strangers tap a tag and remain connected', async ({ browser }) => {
  const uid = freshUid();
  const stamp = Date.now();
  const { error } = await admin.from('tags').insert({ uid });
  expect(error).toBeNull();

  // --- Ada: tap -> claim flow -> sign up -> name -> claim --------------------
  const ada = await (await browser.newContext()).newPage();
  await ada.goto(`/t/${uid}`);
  await ada.waitForURL('**/login**'); // unclaimed -> /claim -> auth gate
  await signUp(ada, `smoke-ada-${stamp}@rls.test`);

  await ada.waitForURL(`**/claim/${uid}`);
  await ada.getByLabel('Name').fill('Smoke Ada');
  await agreeToTerms(ada);
  await ada.getByRole('button', { name: 'Continue' }).click();
  await ada.getByRole('button', { name: 'Claim tag' }).click();

  // claiming lands on the live card
  await ada.waitForURL(`**/t/${uid}`);
  await expect(ada.getByRole('heading', { name: 'Smoke Ada' })).toBeVisible();
  await expect(ada.getByText('This is your tag.')).toBeVisible();

  // --- Bob: tap -> sees the card -> connect (via signup + profile) -----------
  const bob = await (await browser.newContext()).newPage();
  await bob.goto(`/t/${uid}`);
  await expect(bob.getByRole('heading', { name: 'Smoke Ada' })).toBeVisible();

  await bob.getByRole('link', { name: 'Connect' }).click(); // anon -> login
  await signUp(bob, `smoke-bob-${stamp}@rls.test`);

  await bob.waitForURL(`**/t/${uid}`);
  await bob.getByRole('button', { name: 'Connect' }).click();
  await bob.waitForURL('**/profile**'); // no profile yet -> name first
  await bob.getByLabel('Name').fill('Smoke Bob');
  await agreeToTerms(bob);
  await bob.getByRole('button', { name: 'Save' }).click();

  await bob.waitForURL(`**/t/${uid}`);
  await bob.getByRole('button', { name: 'Connect' }).click();
  await expect(bob.getByText(/request sent/i)).toBeVisible();

  // --- Ada accepts from the Requests segment; both see the connection --------
  await ada.goto('/connections');
  const adaSegments = ada.getByRole('navigation', { name: 'Connections lists' });
  await expect(ada.getByRole('heading', { name: 'Connections', exact: true })).toBeVisible();
  await adaSegments.getByRole('link', { name: 'Requests, 1 pending' }).click();
  await expect(ada.getByText('Smoke Bob')).toBeVisible();
  await ada.getByRole('button', { name: 'Accept' }).click();
  await expect(ada.getByText('No requests right now.')).toBeVisible();
  await expect(adaSegments.getByRole('link', { name: 'Requests', exact: true })).toBeVisible();
  await adaSegments.getByRole('link', { name: 'Connections' }).click();
  await expect(ada.getByText('Smoke Bob')).toBeVisible();

  await bob.goto('/connections');
  await expect(bob.getByText('Smoke Ada')).toBeVisible();

  // --- extend-profile: the card tier rides the card a tapper sees ------------
  await ada.goto('/profile');
  // A handicap that does not parse is refused at the form, and nothing saves.
  await ada.getByLabel('Handicap').fill('scratch');
  await ada.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(ada.getByText('A handicap index from +10.0 to 54.0')).toBeVisible();
  await ada.getByLabel('Handicap').fill('+2.4');
  await ada.getByLabel('Home course').fill('Smoke Links');
  // exact: a staged My tags row adds a "Save where … points" button
  await ada.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(ada.getByText('Saved.')).toBeVisible();
  await bob.goto(`/t/${uid}`);
  await expect(bob.getByText('Handicap +2.4 · Smoke Links')).toBeVisible();
  // ... and on every row of people, here Bob's Connections list.
  await bob.goto('/connections');
  await expect(bob.getByText('Handicap +2.4 · Smoke Links')).toBeVisible();
});
