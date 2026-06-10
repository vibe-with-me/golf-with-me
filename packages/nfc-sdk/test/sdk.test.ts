import { beforeEach, describe, expect, it } from 'vitest';
import { NfcSdk } from '../src/index.js';
import { InMemoryStorageAdapter } from '../src/storage/memory.js';

const UID = '04A3B2C1D05E80';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function makeSdk(salt = 'test-salt') {
  return new NfcSdk({ storage: new InMemoryStorageAdapter(), ipHashSalt: salt });
}

describe('NfcSdk tag CRUD', () => {
  let sdk: NfcSdk;

  beforeEach(() => {
    sdk = makeSdk();
  });

  it('createTag applies defaults and returns a full Tag', async () => {
    const tag = await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com' });
    expect(tag.id).toBeTruthy();
    expect(tag.nfc_uid).toBe(UID);
    expect(tag.destination_url).toBe('https://example.com');
    expect(tag.label).toBeNull();
    expect(tag.destination_type).toBe('redirect');
    expect(tag.is_active).toBe(true);
    expect(tag.metadata).toEqual({});
    expect(tag.created_at).toBeTruthy();
    expect(tag.updated_at).toBeTruthy();
  });

  it('createTag normalizes the uid to uppercase', async () => {
    const tag = await sdk.createTag({
      nfc_uid: ' 04a3b2c1d05e80 ',
      destination_url: 'https://example.com',
    });
    expect(tag.nfc_uid).toBe(UID);
  });

  it('createTag rejects a duplicate uid', async () => {
    await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com' });
    await expect(
      sdk.createTag({ nfc_uid: UID.toLowerCase(), destination_url: 'https://other.com' }),
    ).rejects.toThrow();
  });

  it('getTag finds a tag regardless of input casing', async () => {
    await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com' });
    const tag = await sdk.getTag(UID.toLowerCase());
    expect(tag?.nfc_uid).toBe(UID);
  });

  it('getTag returns null for an unknown uid', async () => {
    expect(await sdk.getTag('04FFFFFFFFFFFF')).toBeNull();
  });

  it('updateTag patches fields and bumps updated_at', async () => {
    const created = await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com' });
    await new Promise((r) => setTimeout(r, 5));
    const updated = await sdk.updateTag(UID.toLowerCase(), {
      destination_url: 'https://new.example.com',
      label: 'front door',
    });
    expect(updated.destination_url).toBe('https://new.example.com');
    expect(updated.label).toBe('front door');
    expect(Date.parse(updated.updated_at)).toBeGreaterThan(Date.parse(created.updated_at));
  });

  it('updateTag throws for an unknown uid', async () => {
    await expect(sdk.updateTag('04FFFFFFFFFFFF', { label: 'x' })).rejects.toThrow();
  });

  it('deactivateTag sets is_active to false', async () => {
    await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com' });
    const tag = await sdk.deactivateTag(UID.toLowerCase());
    expect(tag.is_active).toBe(false);
  });

  it('listTags returns all tags and supports the is_active filter', async () => {
    await sdk.createTag({ nfc_uid: UID, destination_url: 'https://a.example.com' });
    await sdk.createTag({ nfc_uid: '04B4C3D2E16F91', destination_url: 'https://b.example.com' });
    await sdk.deactivateTag('04B4C3D2E16F91');

    expect(await sdk.listTags()).toHaveLength(2);
    const active = await sdk.listTags({ is_active: true });
    expect(active).toHaveLength(1);
    expect(active[0]?.nfc_uid).toBe(UID);
    expect(await sdk.listTags({ is_active: false })).toHaveLength(1);
  });
});

describe('NfcSdk.resolve', () => {
  let sdk: NfcSdk;

  beforeEach(() => {
    sdk = makeSdk();
  });

  it('returns unclaimed (with the normalized uid) when no tag exists', async () => {
    const result = await sdk.resolve(' 04a3b2c1d05e80 ');
    expect(result).toEqual({ status: 'unclaimed', uid: UID });
  });

  it('returns found for an active tag', async () => {
    await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com' });
    const result = await sdk.resolve(UID.toLowerCase());
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.tag.destination_url).toBe('https://example.com');
    }
  });

  it('returns inactive for a deactivated tag', async () => {
    await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com' });
    await sdk.deactivateTag(UID);
    const result = await sdk.resolve(UID);
    expect(result.status).toBe('inactive');
    if (result.status === 'inactive') {
      expect(result.tag.is_active).toBe(false);
    }
  });
});

describe('NfcSdk scan logging', () => {
  it('logScan inserts a scan retrievable via listScans', async () => {
    const sdk = makeSdk();
    const tag = await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com' });

    await sdk.logScan({ tag_id: tag.id, scan_method: 'nfc', country: 'US', city: 'Austin' });

    const scans = await sdk.listScans({ tag_id: tag.id });
    expect(scans).toHaveLength(1);
    expect(scans[0]?.tag_id).toBe(tag.id);
    expect(scans[0]?.scan_method).toBe('nfc');
    expect(scans[0]?.country).toBe('US');
    expect(scans[0]?.city).toBe('Austin');
    expect(scans[0]?.scanned_at).toBeTruthy();
  });

  it('hashes the IP and never stores the raw value', async () => {
    const sdk = makeSdk();
    const tag = await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com' });
    const rawIp = '203.0.113.7';

    await sdk.logScan({ tag_id: tag.id, ip: rawIp });

    const [scan] = await sdk.listScans({ tag_id: tag.id });
    expect(scan?.ip_hash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
    expect(scan?.ip_hash).not.toContain(rawIp);
    expect(JSON.stringify(scan)).not.toContain(rawIp);
  });

  it('produces stable hashes for the same salt and different hashes for different salts', async () => {
    const rawIp = '203.0.113.7';

    const hashWithSalt = async (salt: string) => {
      const sdk = makeSdk(salt);
      const tag = await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com' });
      await sdk.logScan({ tag_id: tag.id, ip: rawIp });
      const [scan] = await sdk.listScans({ tag_id: tag.id });
      return scan?.ip_hash;
    };

    const a1 = await hashWithSalt('salt-a');
    const a2 = await hashWithSalt('salt-a');
    const b = await hashWithSalt('salt-b');
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
  });

  it('leaves ip_hash null when no IP is supplied', async () => {
    const sdk = makeSdk();
    const tag = await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com' });
    await sdk.logScan({ tag_id: tag.id });
    const [scan] = await sdk.listScans({ tag_id: tag.id });
    expect(scan?.ip_hash).toBeNull();
  });

  it.each([
    [IPHONE_UA, 'mobile'],
    [IPAD_UA, 'tablet'],
    [DESKTOP_UA, 'desktop'],
  ])('derives device_type from the user agent (%#)', async (ua, expected) => {
    const sdk = makeSdk();
    const tag = await sdk.createTag({ nfc_uid: UID, destination_url: 'https://example.com' });
    await sdk.logScan({ tag_id: tag.id, user_agent: ua });
    const [scan] = await sdk.listScans({ tag_id: tag.id });
    expect(scan?.device_type).toBe(expected);
    expect(scan?.user_agent).toBe(ua);
  });

  it('listScans filters by tag_id', async () => {
    const sdk = makeSdk();
    const tagA = await sdk.createTag({ nfc_uid: UID, destination_url: 'https://a.example.com' });
    const tagB = await sdk.createTag({
      nfc_uid: '04B4C3D2E16F91',
      destination_url: 'https://b.example.com',
    });
    await sdk.logScan({ tag_id: tagA.id });
    await sdk.logScan({ tag_id: tagB.id });
    await sdk.logScan({ tag_id: tagB.id });

    expect(await sdk.listScans({ tag_id: tagA.id })).toHaveLength(1);
    expect(await sdk.listScans({ tag_id: tagB.id })).toHaveLength(2);
  });
});
