// The one smoke test: resolve -> claim -> connect, through real browsers.
// Two strangers tap the same tag and end up connected.
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function freshUid(): string {
  let uid = '';
  for (let i = 0; i < 14; i++) {
    uid += '0123456789ABCDEF'[Math.floor(Math.random() * 16)];
  }
  return uid;
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.getByRole('button', { name: /create an account/i }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('smoke-pass-1!');
  await page.getByRole('button', { name: 'Sign up' }).click();
}

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
  await bob.waitForURL('**/me**'); // no profile yet -> name first
  await bob.getByLabel('Name').fill('Smoke Bob');
  await bob.getByRole('button', { name: 'Save' }).click();

  await bob.waitForURL(`**/t/${uid}`);
  await bob.getByRole('button', { name: 'Connect' }).click();
  await expect(bob.getByText(/request sent/i)).toBeVisible();

  // --- Ada accepts; both sides see the connection ----------------------------
  await ada.goto('/connections');
  await expect(ada.getByText('Smoke Bob')).toBeVisible();
  await ada.getByRole('button', { name: 'Accept' }).click();
  await expect(ada.getByRole('heading', { name: 'Connections', exact: true })).toBeVisible();
  await expect(ada.getByText('Smoke Bob')).toBeVisible();

  await bob.goto('/connections');
  await expect(bob.getByText('Smoke Ada')).toBeVisible();
});
