import { describe, expect, it } from 'vitest';
import { detectScanMethod } from '../src/utils/scan-detection.js';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

describe('detectScanMethod', () => {
  it('detects nfc: no referer + iPhone UA', () => {
    expect(detectScanMethod({ referer: null, userAgent: IPHONE_UA })).toBe('nfc');
  });

  it('detects nfc: no referer + Android UA', () => {
    expect(detectScanMethod({ userAgent: ANDROID_UA })).toBe('nfc');
  });

  it('detects qr: referer containing "qr"', () => {
    expect(
      detectScanMethod({ referer: 'https://qr-scanner.example/result', userAgent: DESKTOP_UA }),
    ).toBe('qr');
  });

  it('detects qr: referer containing "camera"', () => {
    expect(
      detectScanMethod({ referer: 'app://com.example.camera/scan', userAgent: IPHONE_UA }),
    ).toBe('qr');
  });

  it('referer takes precedence over mobile UA: qr referer + mobile UA is qr, not nfc', () => {
    expect(
      detectScanMethod({ referer: 'https://example.com/qr', userAgent: ANDROID_UA }),
    ).toBe('qr');
  });

  it('matches qr referer case-insensitively', () => {
    expect(detectScanMethod({ referer: 'https://example.com/QR-landing' })).toBe('qr');
  });

  it('detects direct: no referer + desktop UA', () => {
    expect(detectScanMethod({ referer: undefined, userAgent: DESKTOP_UA })).toBe('direct');
  });

  it('detects direct: no referer + no UA', () => {
    expect(detectScanMethod({})).toBe('direct');
  });

  it('falls back to unknown: ordinary referer + desktop UA', () => {
    expect(
      detectScanMethod({ referer: 'https://www.google.com/', userAgent: DESKTOP_UA }),
    ).toBe('unknown');
  });

  it('falls back to unknown: ordinary referer + mobile UA', () => {
    expect(
      detectScanMethod({ referer: 'https://news.example.com/article', userAgent: IPHONE_UA }),
    ).toBe('unknown');
  });
});
