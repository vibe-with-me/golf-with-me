import { beforeEach, describe, expect, it } from 'vitest';
import { NfcSdk } from '../src/index.js';
import { InMemoryStorageAdapter } from '../src/storage/memory.js';
import { nfcRouter } from '../src/adapters/hono.js';

const UID = '04A3B2C1D05E80';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

describe('nfcRouter', () => {
  let sdk: NfcSdk;

  beforeEach(() => {
    sdk = new NfcSdk({ storage: new InMemoryStorageAdapter(), ipHashSalt: 'test-salt' });
  });

  it('redirects a found tag with 302 by default', async () => {
    await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com/menu' });
    const app = nfcRouter(sdk);

    const res = await app.request(`/t/${UID.toLowerCase()}`);

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/menu');
  });

  it('honors the redirectStatus option', async () => {
    await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com/menu' });
    const app = nfcRouter(sdk, { redirectStatus: 301 });

    const res = await app.request(`/t/${UID}`);

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://example.com/menu');
  });

  it('returns 404 with a default HTML page for an unclaimed uid', async () => {
    const app = nfcRouter(sdk);

    const res = await app.request(`/t/${UID.toLowerCase()}`);

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain(UID); // normalized uid shown on the page
  });

  it('uses a custom unclaimedPage when provided', async () => {
    const app = nfcRouter(sdk, { unclaimedPage: (uid) => `<p>claim me: ${uid}</p>` });

    const res = await app.request(`/t/${UID}`);

    expect(res.status).toBe(404);
    expect(await res.text()).toBe(`<p>claim me: ${UID}</p>`);
  });

  it('returns 410 with a default HTML page for an inactive tag', async () => {
    await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com/menu' });
    await sdk.deactivateTag(UID);
    const app = nfcRouter(sdk);

    const res = await app.request(`/t/${UID}`);

    expect(res.status).toBe(410);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('uses a custom inactivePage when provided', async () => {
    await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com/menu' });
    await sdk.deactivateTag(UID);
    const app = nfcRouter(sdk, { inactivePage: (tag) => `<p>gone: ${tag.nfc_uid}</p>` });

    const res = await app.request(`/t/${UID}`);

    expect(res.status).toBe(410);
    expect(await res.text()).toBe(`<p>gone: ${UID}</p>`);
  });

  it('logs a scan on a found resolve', async () => {
    const tag = await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com/menu' });
    const app = nfcRouter(sdk);

    const res = await app.request(`/t/${UID}`, {
      headers: { 'user-agent': IPHONE_UA },
    });

    expect(res.status).toBe(302);
    const scans = await sdk.listScans({ tag_id: tag.id });
    expect(scans).toHaveLength(1);
    expect(scans[0]?.scan_method).toBe('nfc'); // no referer + mobile UA
    expect(scans[0]?.device_type).toBe('mobile');
    expect(scans[0]?.user_agent).toBe(IPHONE_UA);
  });

  it('does not log a scan for unclaimed or inactive results', async () => {
    const tag = await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com/menu' });
    await sdk.deactivateTag(UID);
    const app = nfcRouter(sdk);

    await app.request(`/t/${UID}`); // inactive
    await app.request('/t/04FFFFFFFFFFFF'); // unclaimed

    expect(await sdk.listScans({ tag_id: tag.id })).toHaveLength(0);
  });
});
