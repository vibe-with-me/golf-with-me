// The gathering: tap the host's tag, join, see the headcount but not the
// host; connect, and the host appears in who's going. The feed lists it to
// the whole domain.
import { readFile } from 'node:fs/promises';
import { expect, test, type Locator } from '@playwright/test';
import { whenWindow } from '@withme/contract';
import { admin, agreeToTerms, freshUid, signUp, signUpWithProfile } from './helpers.ts';

/** The feed comes a page at a time, and other runs fill the first page:
 * press Load more until the row shows, as a person would. */
async function revealInFeed(feed: Locator, title: string): Promise<void> {
  const row = feed.getByText(title);
  const more = feed.getByRole('button', { name: 'Load more' });
  for (let page = 0; page < 50; page++) {
    await expect(row.or(more).first()).toBeVisible();
    if (await row.isVisible()) return;
    await more.click();
    await expect(feed.getByRole('button', { name: 'Loading…' })).toHaveCount(0);
  }
  await expect(row).toBeVisible();
}

test('the tee sheet narrows to this weekend or later, and the URL keeps the window', async ({ page }) => {
  const stamp = Date.now();
  const name = `When Ada ${stamp}`;
  await signUpWithProfile(page, `smoke-when-${stamp}@rls.test`, name);
  const { data: host, error: hostError } = await admin
    .from('profiles')
    .select('id')
    .eq('display_name', name)
    .single();
  expect(hostError).toBeNull();

  // One in the middle of this weekend's window, one after this week, worked
  // out in this machine's zone, which the browser shares. The browser's clock
  // is held at the same instant, so a run across midnight on Sunday cannot
  // put the seeds and the page's windows in different weeks.
  const reference = new Date();
  await page.clock.setFixedTime(reference);
  const weekend = whenWindow('weekend', reference);
  const middle = (Date.parse(weekend.from!) + Date.parse(weekend.to!)) / 2;
  const later = Date.parse(whenWindow('later', reference).from!) + 86_400_000;
  const weekendTitle = `Weekend ${stamp}`;
  const laterTitle = `Later ${stamp}`;
  const { error } = await admin.from('gatherings').insert([
    { host_id: host!.id, title: weekendTitle, course_name: 'Riverside Muni', starts_at: new Date(middle).toISOString() },
    { host_id: host!.id, title: laterTitle, course_name: 'Riverside Muni', starts_at: new Date(later).toISOString() },
  ]);
  expect(error).toBeNull();

  await page.goto('/rounds');
  const when = page.getByRole('navigation', { name: 'When' });
  await expect(when.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page');
  const discover = page.getByRole('region', { name: 'Tee sheet' });
  /** Opens a window and waits out the previous one's rows. */
  async function choose(label: string, search: string): Promise<void> {
    await when.getByRole('link', { name: label }).click();
    await page.waitForURL(`**/rounds?when=${search}`);
    await expect(discover).not.toHaveAttribute('aria-busy', 'true');
  }

  await choose('This weekend', 'weekend');
  await revealInFeed(discover, weekendTitle);

  // The feed runs in start order, so once the later one shows, the weekend
  // one would already be above it had the window let it in.
  await choose('Later', 'later');
  await revealInFeed(discover, laterTitle);
  await expect(discover.getByText(weekendTitle)).toHaveCount(0);

  // A reload (or a shared link) opens the same window.
  await page.reload();
  await expect(when.getByRole('link', { name: 'Later' })).toHaveAttribute('aria-current', 'page');
  await revealInFeed(discover, laterTitle);
  await expect(discover.getByText(weekendTitle)).toHaveCount(0);

  // An unknown window is the whole feed.
  await page.goto('/rounds?when=someday');
  await expect(when.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page');
});

test("tap a host's tag, join from the feed, and who's going shows only connections", async ({
  browser,
}) => {
  const uid = freshUid();
  const stamp = Date.now();
  const { error } = await admin.from('tags').insert({ uid });
  expect(error).toBeNull();

  // --- Ada: sign up with no destination -> Rounds is the default --------------
  const ada = await (await browser.newContext()).newPage();
  await ada.goto('/login');
  await signUp(ada, `smoke-host-${stamp}@rls.test`);
  await ada.waitForURL(/\/profile\?/);
  await ada.getByLabel('Name').fill('Smoke Ada');
  await agreeToTerms(ada);
  await ada.getByRole('button', { name: 'Save' }).click();
  await ada.waitForURL('**/rounds');
  const adaNav = ada.getByRole('navigation', { name: 'Primary' });
  await expect(adaNav.getByRole('link', { name: 'Rounds' })).toHaveAttribute('aria-current', 'page');

  // --- Ada claims a tag (signed in: tap -> claim flow) --------------------------
  await ada.goto(`/t/${uid}`);
  await ada.waitForURL(`**/claim/${uid}`);
  await ada.getByRole('button', { name: 'Claim tag' }).click();
  await ada.waitForURL(`**/t/${uid}`);
  await expect(ada.getByText('This is your tag.')).toBeVisible();

  // --- Ada creates a round on its own page, and lands on it ---------------------
  await ada.goto('/rounds');
  await ada.getByRole('link', { name: 'New round' }).click();
  await ada.waitForURL('**/rounds/new');
  const title = `Smoke Rooftop ${stamp}`;
  await ada.getByLabel('Title').fill(title);
  await ada.getByLabel('Course', { exact: true }).fill('Riverside Muni');
  await ada.getByLabel('Meet at (optional)').fill('The first tee');
  await ada.getByRole('button', { name: 'Create round' }).click();
  await ada.waitForURL(/\/rounds\/[0-9a-f-]{36}$/);
  const detailPath = new URL(ada.url()).pathname;
  await expect(ada.getByRole('heading', { name: title })).toBeVisible();

  // --- It lists on the tee sheet and in Yours -----------------------------------
  await ada.goto('/rounds');
  const adaSegments = ada.getByRole('navigation', { name: 'Rounds lists' });
  await expect(adaSegments.getByRole('link', { name: 'Tee sheet' })).toHaveAttribute('aria-current', 'page');
  const adaTeeSheet = ada.getByRole('region', { name: 'Tee sheet' });
  await revealInFeed(adaTeeSheet, title);
  await expect(adaTeeSheet.getByText(/Hosting · .* · 1 of 4 playing/)).toBeVisible();
  await adaSegments.getByRole('link', { name: 'Yours' }).click();
  await ada.waitForURL('**/rounds?view=yours');
  const adaYours = ada.getByRole('region', { name: 'Yours' });
  await expect(adaYours.getByText(title)).toBeVisible();

  // --- ...and she points her tag at it from the detail ---------------------------
  await adaYours.getByRole('link', { name: 'Open', exact: true }).click();
  await ada.waitForURL(`**${detailPath}`);
  await expect(ada.getByRole('heading', { name: title })).toBeVisible();
  await expect(ada.getByText('1 of 4 playing')).toBeVisible();
  await expect(ada.getByText('Host', { exact: true })).toBeVisible();
  // The location searches a maps app for its text, encoded, in a new tab.
  // Golf With Me: the course is the place; the meeting point is plain text.
  const maps = ada.getByRole('link', { name: 'Riverside Muni, opens in Maps' });
  await expect(maps).toHaveAttribute(
    'href',
    'https://www.google.com/maps/search/?api=1&query=Riverside%20Muni',
  );
  await expect(maps).toHaveAttribute('target', '_blank');
  await expect(maps).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(ada.getByRole('link', { name: /The first tee/ })).toHaveCount(0);
  await ada.getByRole('button', { name: 'Point my tags at this round' }).click();
  await expect(ada.getByRole('button', { name: 'Point my tags back to my profile' })).toBeVisible();

  // --- Bob: taps anonymously, sees the invitation, signs up, lands on the detail
  const bob = await (await browser.newContext()).newPage();
  await bob.goto(`/t/${uid}`);
  await expect(bob.getByRole('heading', { name: 'Smoke Ada' })).toBeVisible();
  await expect(bob.getByText(title)).toBeVisible();
  await bob.getByRole('link', { name: 'Join this round' }).click(); // shell guard -> login
  await bob.waitForURL(/\/login\?/);
  await signUp(bob, `smoke-guest-${stamp}@rls.test`);
  await bob.waitForURL(/\/profile\?/); // no profile yet: name first, destination remembered
  await bob.getByLabel('Name').fill('Smoke Bob');
  await agreeToTerms(bob);
  await bob.getByRole('button', { name: 'Save' }).click();

  // A stranger reads the detail: the headcount, no member rows, and Join.
  await bob.waitForURL(`**${detailPath}**`);
  await expect(bob.getByRole('heading', { name: title })).toBeVisible();
  await expect(bob.getByText('1 of 4 playing')).toBeVisible();
  await expect(bob.getByText('Smoke Ada')).toHaveCount(0);
  await bob.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(bob.getByText('2 of 4 playing')).toBeVisible();
  await expect(bob.getByRole('button', { name: 'Leave round' })).toBeVisible();
  // Joining revealed Bob's own row and nothing else: the host is not a connection yet.
  await expect(bob.getByText('Smoke Bob')).toBeVisible();
  await expect(bob.getByText('Smoke Ada')).toHaveCount(0);

  // Add to calendar downloads an .ics built in the page: title, time, place
  // and a link back, never who is going or how many.
  const [download] = await Promise.all([
    bob.waitForEvent('download'),
    bob.getByRole('button', { name: 'Add to calendar' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`smoke-rooftop-${stamp}.ics`);
  const ics = await readFile(await download.path(), 'utf8');
  expect(ics).toContain(`SUMMARY:${title}`);
  // Golf With Me: the calendar's place is the course, as the Maps link.
  expect(ics).toContain('LOCATION:Riverside Muni');
  expect(ics.replace(/\r\n /g, '')).toContain(`URL:${new URL(detailPath, bob.url()).href}`);
  expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
  for (const secret of ['Smoke Ada', 'Smoke Bob', 'going', 'ATTENDEE', 'ORGANIZER']) {
    expect(ics).not.toContain(secret);
  }

  // Tapping the tag again as a member opens the gathering instead of inviting twice.
  await bob.goto(`/t/${uid}`);
  await expect(bob.getByRole('link', { name: 'Open round' })).toBeVisible();

  // The feed lists it to Bob as Playing; Ada's side counts him without naming him.
  await bob.goto('/rounds');
  const bobTeeSheet = bob.getByRole('region', { name: 'Tee sheet' });
  await revealInFeed(bobTeeSheet, title);
  await expect(bobTeeSheet.getByText(/Playing · .* · 2 of 4 playing/)).toBeVisible();
  await ada.reload();
  await expect(ada.getByText('2 of 4 playing')).toBeVisible();
  await expect(ada.getByText('Smoke Bob')).toHaveCount(0);

  // --- Connecting is what reveals who's going -------------------------------------
  // Ada points her tag back at her profile so a tap offers Connect.
  await ada.getByRole('button', { name: 'Point my tags back to my profile' }).click();
  await expect(ada.getByRole('button', { name: 'Point my tags at this round' })).toBeVisible();
  await bob.goto(`/t/${uid}`);
  await bob.getByRole('button', { name: 'Connect' }).click();
  await expect(bob.getByText(/request sent/i)).toBeVisible();
  await ada.goto('/connections');
  const adaConnections = ada.getByRole('navigation', { name: 'Connections lists' });
  await adaConnections.getByRole('link', { name: 'Requests, 1 pending' }).click();
  await ada.getByRole('button', { name: 'Accept' }).click();
  await expect(adaConnections.getByRole('link', { name: 'Requests', exact: true })).toBeVisible();

  // Now each sees the other in who's going, and the feed names them.
  await bob.goto(detailPath);
  await expect(bob.getByText('Smoke Ada')).toBeVisible();
  await bob.goto('/rounds');
  await revealInFeed(bobTeeSheet, title);
  await expect(bobTeeSheet.getByText('With Smoke Ada')).toBeVisible();
  await ada.goto(detailPath);
  await expect(ada.getByText('Smoke Bob')).toBeVisible();
});
