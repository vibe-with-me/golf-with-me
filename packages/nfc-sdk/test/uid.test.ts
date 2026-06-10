import { describe, expect, it } from 'vitest';
import { isValidUid, normalizeUid } from '../src/utils/uid.js';

// 7-byte NTAG213 UID = 14 hex chars
const UID = '04A3B2C1D05E80';

describe('normalizeUid', () => {
  it('uppercases the uid', () => {
    expect(normalizeUid('04a3b2c1d05e80')).toBe(UID);
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeUid('  04a3b2c1d05e80\n')).toBe(UID);
  });

  it('leaves an already-normalized uid unchanged', () => {
    expect(normalizeUid(UID)).toBe(UID);
  });
});

describe('isValidUid', () => {
  it('accepts a 14-char hex uid (NTAG213 7-byte UID)', () => {
    expect(isValidUid(UID)).toBe(true);
  });

  it('accepts lowercase and padded input by normalizing first', () => {
    expect(isValidUid(' 04a3b2c1d05e80 ')).toBe(true);
  });

  it('rejects uids that are too short', () => {
    expect(isValidUid('04A3B2C1')).toBe(false);
  });

  it('rejects uids that are too long', () => {
    expect(isValidUid('04A3B2C1D05E80FF')).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(isValidUid('04A3B2C1D05EG0')).toBe(false);
  });

  it('rejects the empty string', () => {
    expect(isValidUid('')).toBe(false);
  });
});
